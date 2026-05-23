// Per-row transactional loader. Runs inside an outer dry-run TX (savepoints)
// or as its own TX (commits per row). Insert order is fixed to honor FKs:
// agents → customers → service_addresses → esis → contracts → deals →
// commission_statements → aggregator_payouts. Resold self-link is left NULL
// here and filled by pass 2.

import { and, eq, sql, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../workers/db/schema";
import {
  customers,
  serviceAddresses,
  esis,
  contracts,
  deals,
  commissionStatements,
  aggregatorPayouts,
} from "../../workers/db/schema";
import {
  addressKey,
  AgentCache,
  findServiceAddressByKey,
} from "./dedup";
import type { TransformedRow } from "./types";

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;
export type TxLike =
  | DbInstance
  | Parameters<Parameters<DbInstance["transaction"]>[0]>[0];

export interface RowCounts {
  customers: { inserted: number; updated: number };
  service_addresses: { inserted: number; reused: number };
  esis: { inserted: number; updated: number };
  contracts: { inserted: number; updated: number };
  deals: { inserted: number; updated: number };
  commission_statements: { inserted: number; reused: number };
  aggregator_payouts: { inserted: number; reused: number };
}

export interface LoadOpts {
  tenantId: string;
  agentCache: AgentCache;
  saleIdToContractId: Map<string, string>;
}

export function emptyRowCounts(): RowCounts {
  return {
    customers: { inserted: 0, updated: 0 },
    service_addresses: { inserted: 0, reused: 0 },
    esis: { inserted: 0, updated: 0 },
    contracts: { inserted: 0, updated: 0 },
    deals: { inserted: 0, updated: 0 },
    commission_statements: { inserted: 0, reused: 0 },
    aggregator_payouts: { inserted: 0, reused: 0 },
  };
}

export function addRowCounts(a: RowCounts, b: RowCounts): void {
  for (const k of Object.keys(a) as (keyof RowCounts)[]) {
    const av = a[k] as Record<string, number>;
    const bv = b[k] as Record<string, number>;
    for (const f of Object.keys(av)) av[f] += bv[f];
  }
}

/** `xmax = 0` distinguishes a fresh insert from an ON CONFLICT update. */
const wasInsertedSql = sql<boolean>`(xmax = 0)`;

export interface LoadResult {
  counts: RowCounts;
  contractId: string;
}

export async function loadRow(
  executor: TxLike,
  opts: LoadOpts,
  row: TransformedRow,
): Promise<LoadResult> {
  return executor.transaction(async (tx) => {
    const counts = emptyRowCounts();
    const { tenantId } = opts;

    // 1. Agents — pre-warmed via AgentCache.prewarm before any per-row work.
    // Pure in-memory lookup here; no DB writes inside the per-row savepoint,
    // so failures elsewhere in this tx can't leave stale UUIDs in the cache.
    const primaryAgentId = opts.agentCache.get(row.primaryAgentName);
    const secondaryAgentId = opts.agentCache.get(row.secondaryAgentName);

    // 2. Customer (UPSERT on tenant_id, external_customer_id).
    const customerRows = await tx
      .insert(customers)
      .values({
        tenantId,
        name: row.customerName,
        externalCustomerId: row.externalCustomerId,
        primaryContactName: row.primaryContactName,
        primaryTitle: row.primaryTitle,
        primaryEmail: row.primaryEmail,
        primaryPhone: row.primaryPhone,
        sicCode: row.sicCode,
        businessType: row.businessType,
        category: row.category,
        region: row.region,
        county: row.customerCounty,
        creditScore: row.creditScore,
        annualRevenue: row.annualRevenue,
      })
      .onConflictDoUpdate({
        target: [customers.tenantId, customers.externalCustomerId],
        set: {
          name: row.customerName,
          primaryContactName: row.primaryContactName,
          primaryTitle: row.primaryTitle,
          primaryEmail: row.primaryEmail,
          primaryPhone: row.primaryPhone,
          sicCode: row.sicCode,
          businessType: row.businessType,
          category: row.category,
          region: row.region,
          county: row.customerCounty,
          creditScore: row.creditScore,
          annualRevenue: row.annualRevenue,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: customers.id, inserted: wasInsertedSql });
    const customerId = customerRows[0]!.id;
    if (customerRows[0]!.inserted) counts.customers.inserted++;
    else counts.customers.updated++;

    // 3. Service address (SELECT-then-INSERT on normalized key).
    const addrKey = addressKey(row);
    let serviceAddressId =
      addrKey === ""
        ? null
        : await findServiceAddressByKey(tx, tenantId, customerId, addrKey);
    if (!serviceAddressId) {
      const addrRows = await tx
        .insert(serviceAddresses)
        .values({
          tenantId,
          customerId,
          streetNo: row.streetNo,
          streetName: row.streetName,
          addressLine1: row.addressLine1,
          addressLine2: row.addressLine2,
          city: row.city,
          state: row.state,
          zip: row.zip,
          county: row.addressCounty,
          govtArea: row.govtArea,
        })
        .returning({ id: serviceAddresses.id });
      serviceAddressId = addrRows[0]!.id;
      counts.service_addresses.inserted++;
    } else {
      counts.service_addresses.reused++;
    }

    // 4. ESI (UPSERT on tenant_id, esi_id).
    const esiRows = await tx
      .insert(esis)
      .values({
        tenantId,
        serviceAddressId,
        esiId: row.esiId,
        physicalMeterSerial: row.physicalMeterSerial,
        eacKwh: row.eacKwh,
        billingAqKwh: row.billingAqKwh,
        annualUsageKwh: row.annualUsageKwh,
      })
      .onConflictDoUpdate({
        target: [esis.tenantId, esis.esiId],
        set: {
          serviceAddressId,
          physicalMeterSerial: row.physicalMeterSerial,
          eacKwh: row.eacKwh,
          billingAqKwh: row.billingAqKwh,
          annualUsageKwh: row.annualUsageKwh,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: esis.id, inserted: wasInsertedSql });
    const esiPkId = esiRows[0]!.id;
    if (esiRows[0]!.inserted) counts.esis.inserted++;
    else counts.esis.updated++;

    // 5. Contract (UPSERT on tenant_id, external_sale_id). Leave
    // resold_from_contract_id NULL — pass 2 fills it.
    const contractRows = await tx
      .insert(contracts)
      .values({
        tenantId,
        esiId: esiPkId,
        externalSaleId: row.externalSaleId,
        supplier: row.supplier,
        supplyType: row.supplyType,
        startDate: row.startDate,
        endDate: row.endDate,
        agentMils: row.agentMils,
        currency: row.currency,
        fxRate: row.fxRate,
        pipelineStatus: row.pipelineStatus,
        isLive: row.isLive,
        saleType: row.saleType,
        lostDate: row.lostDate,
        lostReason: row.lostReason,
        lostBeforeStart: row.lostBeforeStart,
        lostAfterLive: row.lostAfterLive,
        completedPostLive: row.completedPostLive,
        nomination: row.nomination,
        paymentTerm: row.paymentTerm,
        resoldStatus: row.resoldStatus,
        isResold: row.isResold,
        annualUsageKwh: row.annualUsageKwh,
        grossTcvXlsx: row.grossTcvXlsx,
        netTcvXlsx: row.netTcvXlsx,
        lostTcv: row.lostTcv,
        aqLoss: row.aqLoss,
        aqGain: row.aqGain,
        aqCheck: row.aqCheck,
        lostPartial: row.lostPartial,
      })
      .onConflictDoUpdate({
        target: [contracts.tenantId, contracts.externalSaleId],
        set: {
          esiId: esiPkId,
          supplier: row.supplier,
          supplyType: row.supplyType,
          startDate: row.startDate,
          endDate: row.endDate,
          agentMils: row.agentMils,
          currency: row.currency,
          fxRate: row.fxRate,
          pipelineStatus: row.pipelineStatus,
          isLive: row.isLive,
          saleType: row.saleType,
          lostDate: row.lostDate,
          lostReason: row.lostReason,
          lostBeforeStart: row.lostBeforeStart,
          lostAfterLive: row.lostAfterLive,
          completedPostLive: row.completedPostLive,
          nomination: row.nomination,
          paymentTerm: row.paymentTerm,
          resoldStatus: row.resoldStatus,
          isResold: row.isResold,
          annualUsageKwh: row.annualUsageKwh,
          grossTcvXlsx: row.grossTcvXlsx,
          netTcvXlsx: row.netTcvXlsx,
          lostTcv: row.lostTcv,
          aqLoss: row.aqLoss,
          aqGain: row.aqGain,
          aqCheck: row.aqCheck,
          lostPartial: row.lostPartial,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: contracts.id, inserted: wasInsertedSql });
    const contractId = contractRows[0]!.id;
    if (contractRows[0]!.inserted) counts.contracts.inserted++;
    else counts.contracts.updated++;
    // NOTE: `saleIdToContractId.set(...)` deliberately moved to the entry
    // script, which only updates the map AFTER this tx commits. Mutating the
    // map here would leave a stale UUID behind if a later statement throws and
    // the savepoint rolls back — pass 2 would then link to a dead row silently.

    // 6. Deal (UPSERT on tenant_id, external_sale_id).
    const dealRows = await tx
      .insert(deals)
      .values({
        tenantId,
        customerId,
        primaryAgentId,
        secondaryAgentId,
        contractId,
        externalSaleId: row.externalSaleId,
        saleDate: row.saleDate,
        saleStatus: row.saleStatus,
        objectionStatus: row.objectionStatus,
        objectionType: row.objectionType,
        sourceOfLead: row.sourceOfLead,
      })
      .onConflictDoUpdate({
        target: [deals.tenantId, deals.externalSaleId],
        set: {
          customerId,
          primaryAgentId,
          secondaryAgentId,
          contractId,
          saleDate: row.saleDate,
          saleStatus: row.saleStatus,
          objectionStatus: row.objectionStatus,
          objectionType: row.objectionType,
          sourceOfLead: row.sourceOfLead,
          updatedAt: sql`now()`,
        },
      })
      .returning({ inserted: wasInsertedSql });
    if (dealRows[0]!.inserted) counts.deals.inserted++;
    else counts.deals.updated++;

    // 7. Commission statement — only if any field non-null, dedup by
    // (contract_id, period_start NULL, period_end NULL).
    const hasCommissionData =
      row.receivedAmount !== null ||
      row.outstandingAmount !== null ||
      row.netOutstanding !== null ||
      row.agentCommsPaid !== null ||
      row.agentCommsOutstanding !== null ||
      row.billingAqKwh !== null ||
      row.supplier !== null;
    if (hasCommissionData) {
      const existing = await tx
        .select({ id: commissionStatements.id })
        .from(commissionStatements)
        .where(
          and(
            eq(commissionStatements.tenantId, tenantId),
            eq(commissionStatements.contractId, contractId),
            isNull(commissionStatements.periodStart),
            isNull(commissionStatements.periodEnd),
          ),
        )
        .limit(1);
      if (existing[0]) {
        counts.commission_statements.reused++;
      } else {
        await tx.insert(commissionStatements).values({
          tenantId,
          contractId,
          supplier: row.supplier,
          billingAqKwh: row.billingAqKwh,
          mils: row.agentMils,
          receivedAmount: row.receivedAmount,
          outstandingAmount: row.outstandingAmount,
          netOutstanding: row.netOutstanding,
          agentCommsPaid: row.agentCommsPaid,
          agentCommsOutstanding: row.agentCommsOutstanding,
        });
        counts.commission_statements.inserted++;
      }
    }

    // 8. Aggregator payout — only if aggregator name non-null.
    if (row.aggregatorName) {
      const existing = await tx
        .select({ id: aggregatorPayouts.id })
        .from(aggregatorPayouts)
        .where(
          and(
            eq(aggregatorPayouts.tenantId, tenantId),
            eq(aggregatorPayouts.contractId, contractId),
            eq(aggregatorPayouts.aggregatorName, row.aggregatorName),
            isNull(aggregatorPayouts.periodStart),
            isNull(aggregatorPayouts.periodEnd),
          ),
        )
        .limit(1);
      if (existing[0]) {
        counts.aggregator_payouts.reused++;
      } else {
        await tx.insert(aggregatorPayouts).values({
          tenantId,
          contractId,
          aggregatorName: row.aggregatorName,
          aggregatorCommPct: row.aggregatorCommPct,
        });
        counts.aggregator_payouts.inserted++;
      }
    }

    return { counts, contractId };
  });
}

/**
 * Pass 2: resolve `contracts.resold_from_contract_id` from xlsx `Resold Sale Id`.
 * Uses the in-memory sale_id → contract_id map populated during pass 1 first;
 * falls back to a DB SELECT for any sale_id missing from the map (robust to
 * partial re-runs).
 */
export async function resolveResoldLinks(
  executor: TxLike,
  opts: LoadOpts,
  rows: readonly TransformedRow[],
): Promise<{ linked: number; missing: number }> {
  let linked = 0;
  let missing = 0;
  const { tenantId, saleIdToContractId } = opts;

  for (const row of rows) {
    if (!row.resoldSaleId) continue;
    const childId = saleIdToContractId.get(row.externalSaleId);
    if (!childId) {
      missing++;
      continue;
    }
    let sourceId = saleIdToContractId.get(row.resoldSaleId);
    if (!sourceId) {
      const found = await executor
        .select({ id: contracts.id })
        .from(contracts)
        .where(
          and(
            eq(contracts.tenantId, tenantId),
            eq(contracts.externalSaleId, row.resoldSaleId),
          ),
        )
        .limit(1);
      sourceId = found[0]?.id;
      if (sourceId) saleIdToContractId.set(row.resoldSaleId, sourceId);
    }
    if (!sourceId) {
      missing++;
      continue;
    }
    await executor
      .update(contracts)
      .set({
        resoldFromContractId: sourceId,
        isResold: true,
        updatedAt: sql`now()`,
      })
      .where(eq(contracts.id, childId));
    linked++;
  }

  return { linked, missing };
}
