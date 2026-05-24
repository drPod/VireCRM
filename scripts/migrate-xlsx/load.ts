// Bulk loader: chunked upsert per table with FK maps built in-memory.
//
// Replaces an earlier per-row transactional loader that did ~10 sequential
// queries per row over the Supavisor pooler (~1-2s/row, ~87h projected for
// 4,792 rows). This version groups rows into chunks of CHUNK_SIZE, issues one
// upsert per table per chunk, and threads FK ids through TS maps populated
// from each pass's RETURNING clause. Cost is ~8 round trips per chunk
// (≈80 total) instead of ~47,000.
//
// Passes (FK order):
//   1. customers          UPSERT (tenant_id, external_customer_id)
//   2. service_addresses  SELECT-then-bulk-INSERT (no natural key)
//   3. esis               UPSERT (tenant_id, esi_id)
//   4. contracts          UPSERT (tenant_id, external_sale_id) — resold link NULL
//   5. deals              UPSERT (tenant_id, external_sale_id)
//   6. commission_stmts   SELECT-existing + bulk INSERT new (no natural key)
//   7. aggregator_payouts SELECT-existing + bulk INSERT new (no natural key)
//   8. resold links       bulk UPDATE FROM VALUES
//
// Idempotent: ON CONFLICT DO UPDATE on natural keys (passes 1, 3, 4, 5);
// SELECT-then-INSERT on (passes 2, 6, 7). Re-runs converge to the same state.
//
// Chunk-level retry on transient Supavisor connection drops (3 attempts with
// backoff). If a chunk still fails, the whole migration aborts — partial state
// is safe to leave (next run resumes via the same idempotent upserts).

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
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
import { addressKey, AgentCache } from "./dedup";
import type { QuarantineRecord, TransformedRow } from "./types";

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

export interface LoadAllResult {
  counts: RowCounts;
  processedRows: number;
  failedRows: number;
  resoldLinks: { linked: number; missing: number };
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

// 300 rows × ≤30 cols ≈ 9,000 bind params per stmt, well under the 65,535 PG
// per-statement bind-param ceiling and inside Supavisor's payload comfort zone.
const CHUNK_SIZE = 300;
const MAX_ATTEMPTS = 3;

/** `xmax = 0` distinguishes a fresh insert from an ON CONFLICT update. */
const wasInsertedSql = sql<boolean>`(xmax = 0)`;

function isTransientError(err: unknown): boolean {
  // Drizzle's DrizzleQueryError wraps the postgres-js error in `.cause`. The
  // structured fields (code, etc.) live on the inner object, so check both.
  const outer = err as { code?: string; cause?: unknown } | null;
  const inner = outer?.cause as { code?: string } | undefined;
  const code = inner?.code ?? outer?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === "CONNECTION_CLOSED" ||
    code === "CONNECTION_DESTROYED" ||
    code === "CONNECTION_ENDED" ||
    code === "CONNECT_TIMEOUT" ||
    // 57014 = query_canceled (statement_timeout). On Supabase Micro the 120s
    // default fires under contention (autovacuum, checkpoint, neighbor load).
    // Bulk passes are idempotent (ON CONFLICT), retry is safe.
    code === "57014" ||
    /Cannot read properties of null \(reading 'write'\)/.test(msg) ||
    /null is not an object \(evaluating 'socket\.write'\)/.test(msg)
  );
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  // Drizzle wraps the postgres-js PostgresError in `.cause`; the outer object
  // is a `DrizzleQueryError` whose `.message` is just "Failed query: <sql>".
  // The PG diagnostic (code/constraint/detail/etc.) lives on the cause.
  const outer = lastErr as Record<string, unknown> | null;
  const inner = (outer?.cause ?? outer) as Record<string, unknown> | null;
  const pickStr = (...keys: string[]): string | undefined => {
    if (!inner) return undefined;
    for (const k of keys) {
      const v = inner[k];
      if (typeof v === "string" && v.length > 0) return v;
    }
    return undefined;
  };
  const detail = {
    code: pickStr("code"),
    severity: pickStr("severity_local", "severity"),
    message: pickStr("message_local", "message") ??
      (lastErr instanceof Error ? lastErr.message.split("\n")[0] : null),
    detail: pickStr("detail"),
    hint: pickStr("hint"),
    constraint: pickStr("constraint_name", "constraint"),
    table: pickStr("table_name", "table"),
    column: pickStr("column_name", "column"),
    where: pickStr("where"),
    routine: pickStr("routine"),
    schema: pickStr("schema_name", "schema"),
    causeKeys: inner
      ? Object.getOwnPropertyNames(inner).slice(0, 20).join(",")
      : null,
  };
  process.stderr.write(
    `[withRetry] ${label} fatal — ${JSON.stringify(detail)}\n`,
  );
  throw new Error(
    `${label} failed after ${MAX_ATTEMPTS} attempts: ${detail.code ?? ""} ${detail.message ?? ""}`,
  );
}

function chunked<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function loadAllBulk(
  executor: TxLike,
  opts: LoadOpts,
  rows: readonly TransformedRow[],
  quarantine: (rec: QuarantineRecord) => void,
): Promise<LoadAllResult> {
  const counts = emptyRowCounts();
  const { tenantId, saleIdToContractId } = opts;

  // Suppress cascading quarantines: a row that fails in pass 1/2 would also
  // fail downstream FK lookups in passes 3-5, producing 3-4 quarantine events
  // per dropped row and inflating the error ratio. Track failures once per row.
  const failedRowNumbers = new Set<number>();
  const reportFailure = (rec: QuarantineRecord): void => {
    if (rec.severity === "error" && failedRowNumbers.has(rec.rowNumber)) return;
    if (rec.severity === "error") failedRowNumbers.add(rec.rowNumber);
    quarantine(rec);
  };

  if (rows.length === 0) {
    return {
      counts,
      processedRows: 0,
      failedRows: 0,
      resoldLinks: { linked: 0, missing: 0 },
    };
  }

  // -------- Pass 1: customers ------------------------------------------------
  // Dedup by externalCustomerId — many xlsx rows share the same customer.
  // Last row wins on UPDATE fields (matches per-row loader's last-write-wins
  // behavior since each row would call ON CONFLICT DO UPDATE).
  const customerMap = new Map<string, string>(); // externalCustomerId → customerId
  const customerByExtId = new Map<string, TransformedRow>();
  for (const r of rows) customerByExtId.set(r.externalCustomerId, r);
  const customerValues = [...customerByExtId.values()].map((r) => ({
    tenantId,
    name: r.customerName,
    externalCustomerId: r.externalCustomerId,
    primaryContactName: r.primaryContactName,
    primaryTitle: r.primaryTitle,
    primaryEmail: r.primaryEmail,
    primaryPhone: r.primaryPhone,
    sicCode: r.sicCode,
    businessType: r.businessType,
    category: r.category,
    region: r.region,
    county: r.customerCounty,
    creditScore: r.creditScore,
    annualRevenue: r.annualRevenue,
  }));
  for (const chunk of chunked(customerValues, CHUNK_SIZE)) {
    const result = await withRetry("customers chunk", () =>
      executor
        .insert(customers)
        .values(chunk)
        .onConflictDoUpdate({
          target: [customers.tenantId, customers.externalCustomerId],
          set: {
            name: sql`excluded.name`,
            primaryContactName: sql`excluded.primary_contact_name`,
            primaryTitle: sql`excluded.primary_title`,
            primaryEmail: sql`excluded.primary_email`,
            primaryPhone: sql`excluded.primary_phone`,
            sicCode: sql`excluded.sic_code`,
            businessType: sql`excluded.business_type`,
            category: sql`excluded.category`,
            region: sql`excluded.region`,
            county: sql`excluded.county`,
            creditScore: sql`excluded.credit_score`,
            annualRevenue: sql`excluded.annual_revenue`,
            updatedAt: sql`now()`,
          },
        })
        .returning({
          id: customers.id,
          externalCustomerId: customers.externalCustomerId,
          inserted: wasInsertedSql,
        }),
    );
    for (const r of result) {
      customerMap.set(r.externalCustomerId!, r.id);
      if (r.inserted) counts.customers.inserted++;
      else counts.customers.updated++;
    }
  }

  // -------- Pass 2: service_addresses ---------------------------------------
  // No natural key. Dedup per (customerId, addressKey). Empty addressKey =>
  // never reuse, always insert a fresh row. Per-customer SELECT to find
  // matching existing rows, then bulk INSERT the new pairs.
  const addressMap = new Map<string, string>(); // rowNumber → serviceAddressId
  const emptyKeyRows: TransformedRow[] = [];
  const keyedPairs: { row: TransformedRow; customerId: string; key: string }[] = [];
  for (const r of rows) {
    const customerId = customerMap.get(r.externalCustomerId);
    if (!customerId) continue; // shouldn't happen; pass 1 covered all
    const k = addressKey(r);
    if (k === "") emptyKeyRows.push(r);
    else keyedPairs.push({ row: r, customerId, key: k });
  }
  // Lookup existing matches grouped by customer. customer_ids per chunk to
  // bound payload; one SELECT per chunk. Composite key matched in TS.
  const existingByPair = new Map<string, string>(); // `${customerId}|${key}` → id
  const sqlAddrKey = sql<string>`regexp_replace(upper(concat_ws('|',
    coalesce(${serviceAddresses.streetNo}, ''),
    coalesce(${serviceAddresses.streetName}, ''),
    coalesce(${serviceAddresses.addressLine1}, ''),
    coalesce(${serviceAddresses.addressLine2}, ''),
    coalesce(${serviceAddresses.city}, ''),
    coalesce(${serviceAddresses.state}, ''),
    coalesce(${serviceAddresses.zip}, '')
  )), '[^A-Z0-9|]', '', 'g')`;
  const customerIdsToProbe = [...new Set(keyedPairs.map((p) => p.customerId))];
  for (const chunk of chunked(customerIdsToProbe, CHUNK_SIZE)) {
    const existing = await withRetry("service_addresses probe", () =>
      executor
        .select({
          id: serviceAddresses.id,
          customerId: serviceAddresses.customerId,
          k: sqlAddrKey,
        })
        .from(serviceAddresses)
        .where(
          and(
            eq(serviceAddresses.tenantId, tenantId),
            inArray(serviceAddresses.customerId, chunk),
          ),
        ),
    );
    for (const e of existing) existingByPair.set(`${e.customerId}|${e.k}`, e.id);
  }
  // Resolve reuses + collect unique new pairs in one walk.
  // `firstByDupKey` keeps the first row per (customerId, key) — that row gets
  // inserted; siblings sharing the same key reuse its id via `insertedByPair`
  // after the chunk lands.
  type AddrPair = { row: TransformedRow; customerId: string; key: string };
  const firstByDupKey = new Map<string, AddrPair>();
  for (const p of keyedPairs) {
    const dupKey = `${p.customerId}|${p.key}`;
    const found = existingByPair.get(dupKey);
    if (found) {
      addressMap.set(String(p.row.rowNumber), found);
      counts.service_addresses.reused++;
      continue;
    }
    if (!firstByDupKey.has(dupKey)) firstByDupKey.set(dupKey, p);
  }
  const insertedByPair = new Map<string, string>();
  const buildAddrValue = (r: TransformedRow, customerId: string) => ({
    tenantId,
    customerId,
    streetNo: r.streetNo,
    streetName: r.streetName,
    addressLine1: r.addressLine1,
    addressLine2: r.addressLine2,
    city: r.city,
    state: r.state,
    zip: r.zip,
    county: r.addressCounty,
    govtArea: r.govtArea,
  });
  // No retry: service_addresses has no UNIQUE constraint on the address key,
  // so a transient-error retry after the server committed would duplicate rows.
  // Failing loud is preferable; the next run pre-probes existing rows and
  // dedup-collapses anyway.
  const uniquePairs = [...firstByDupKey.values()];
  for (const chunk of chunked(uniquePairs, CHUNK_SIZE)) {
    const result = await executor
      .insert(serviceAddresses)
      .values(chunk.map((p) => buildAddrValue(p.row, p.customerId)))
      .returning({
        id: serviceAddresses.id,
        customerId: serviceAddresses.customerId,
        k: sqlAddrKey,
      });
    for (const r of result) {
      insertedByPair.set(`${r.customerId}|${r.k}`, r.id);
      counts.service_addresses.inserted++;
    }
  }
  // Map sibling pairs (same key, multiple rowNumbers) to inserted ids and
  // count them as reused to match the per-row loader's semantics: row 1
  // inserted (counted by the chunk loop above), rows 2..N saw row 1's commit
  // and counted as reused.
  for (const p of keyedPairs) {
    if (addressMap.has(String(p.row.rowNumber))) continue;
    const id = insertedByPair.get(`${p.customerId}|${p.key}`);
    if (id) {
      addressMap.set(String(p.row.rowNumber), id);
      counts.service_addresses.reused++;
    }
  }
  // Empty-key rows: one INSERT per row, no dedup. Chunked for stmt size.
  const emptyKeyEntries = emptyKeyRows
    .map((r) => {
      const customerId = customerMap.get(r.externalCustomerId);
      return customerId ? { row: r, customerId } : null;
    })
    .filter((x): x is { row: TransformedRow; customerId: string } => x !== null);
  // INSERT ... RETURNING preserves VALUES order in PG (current implementation),
  // so we can zip the chunk to result by index.
  // No retry: same reason as above — duplicate insertion risk on transient
  // disconnect after server-side commit.
  for (const chunk of chunked(emptyKeyEntries, CHUNK_SIZE)) {
    const result = await executor
      .insert(serviceAddresses)
      .values(chunk.map((e) => buildAddrValue(e.row, e.customerId)))
      .returning({ id: serviceAddresses.id });
    for (let i = 0; i < chunk.length; i++) {
      addressMap.set(String(chunk[i]!.row.rowNumber), result[i]!.id);
      counts.service_addresses.inserted++;
    }
  }

  // -------- Pass 3: esis -----------------------------------------------------
  // UPSERT keyed on (tenant_id, esi_id). Dedup TS-side by esi_id — last-seen
  // row owns the service_address_id + meter/usage fields, matching last-write
  // semantics of the prior per-row loader.
  const esiMap = new Map<string, string>(); // esiId → esisPK
  const esiByKey = new Map<string, { row: TransformedRow; serviceAddressId: string }>();
  for (const r of rows) {
    const serviceAddressId = addressMap.get(String(r.rowNumber));
    if (!serviceAddressId) {
      reportFailure({
        rowNumber: r.rowNumber,
        column: "row",
        header: "load",
        rawValue: "",
        reason: "esi pass: no service_address resolved (customer pass missed)",
        severity: "error",
      });
      continue;
    }
    esiByKey.set(r.esiId, { row: r, serviceAddressId });
  }
  const esiValues = [...esiByKey.values()].map((e) => ({
    tenantId,
    serviceAddressId: e.serviceAddressId,
    esiId: e.row.esiId,
    physicalMeterSerial: e.row.physicalMeterSerial,
    eacKwh: e.row.eacKwh,
    billingAqKwh: e.row.billingAqKwh,
    annualUsageKwh: e.row.annualUsageKwh,
  }));
  const esiInsertedKeys = new Set<string>();
  for (const chunk of chunked(esiValues, CHUNK_SIZE)) {
    const result = await withRetry("esis chunk", () =>
      executor
        .insert(esis)
        .values(chunk)
        .onConflictDoUpdate({
          target: [esis.tenantId, esis.esiId],
          set: {
            serviceAddressId: sql`excluded.service_address_id`,
            physicalMeterSerial: sql`excluded.physical_meter_serial`,
            eacKwh: sql`excluded.eac_kwh`,
            billingAqKwh: sql`excluded.billing_aq_kwh`,
            annualUsageKwh: sql`excluded.annual_usage_kwh`,
            updatedAt: sql`now()`,
          },
        })
        .returning({
          id: esis.id,
          esiId: esis.esiId,
          inserted: wasInsertedSql,
        }),
    );
    for (const r of result) {
      esiMap.set(r.esiId, r.id);
      if (r.inserted) esiInsertedKeys.add(r.esiId);
    }
  }
  // Per-row tally matching the prior per-row loader: first xlsx row to touch
  // an esiId counts as inserted (if the upsert inserted) or updated (if it
  // hit an existing row); sibling rows sharing the same esiId all count as
  // updated. Without this walk, the bulk RETURNING gives counts in terms of
  // unique keys, not rows.
  {
    const firstSeen = new Set<string>();
    for (const r of rows) {
      if (!esiMap.has(r.esiId)) continue;
      if (firstSeen.has(r.esiId)) {
        counts.esis.updated++;
        continue;
      }
      firstSeen.add(r.esiId);
      if (esiInsertedKeys.has(r.esiId)) counts.esis.inserted++;
      else counts.esis.updated++;
    }
  }

  // -------- Pass 4: contracts ------------------------------------------------
  // UPSERT keyed on (tenant_id, external_sale_id). Dedup TS-side by
  // external_sale_id (last-write-wins among VALID rows). resold_from_contract_id
  // is left NULL here; pass 8 fills it.
  //
  // ESI validation MUST run before the Map.set step: previous order let a
  // valid earlier dup get overwritten by a later dup missing ESI, then the
  // later dup failed the check, dropping the entire externalSaleId.
  const contractByKey = new Map<string, TransformedRow>();
  for (const r of rows) {
    if (!esiMap.has(r.esiId)) {
      reportFailure({
        rowNumber: r.rowNumber,
        column: "row",
        header: "load",
        rawValue: "",
        reason: "contract pass: no esi resolved (esi pass missed)",
        severity: "error",
      });
      continue;
    }
    contractByKey.set(r.externalSaleId, r);
  }
  const contractValues = [...contractByKey.values()].map((r) => {
    const esiPk = esiMap.get(r.esiId)!;
    return {
      tenantId,
      esiId: esiPk,
      externalSaleId: r.externalSaleId,
      supplier: r.supplier,
      supplyType: r.supplyType,
      startDate: r.startDate,
      endDate: r.endDate,
      agentMils: r.agentMils,
      currency: r.currency,
      fxRate: r.fxRate,
      pipelineStatus: r.pipelineStatus,
      isLive: r.isLive,
      saleType: r.saleType,
      lostDate: r.lostDate,
      lostReason: r.lostReason,
      lostBeforeStart: r.lostBeforeStart,
      lostAfterLive: r.lostAfterLive,
      completedPostLive: r.completedPostLive,
      nomination: r.nomination,
      paymentTerm: r.paymentTerm,
      resoldStatus: r.resoldStatus,
      isResold: r.isResold,
      annualUsageKwh: r.annualUsageKwh,
      grossTcvXlsx: r.grossTcvXlsx,
      netTcvXlsx: r.netTcvXlsx,
      lostTcv: r.lostTcv,
      aqLoss: r.aqLoss,
      aqGain: r.aqGain,
      aqCheck: r.aqCheck,
      lostPartial: r.lostPartial,
    };
  });
  const contractInsertedKeys = new Set<string>();
  for (const chunk of chunked(contractValues, CHUNK_SIZE)) {
    const result = await withRetry("contracts chunk", () =>
      executor
        .insert(contracts)
        .values(chunk)
        .onConflictDoUpdate({
          target: [contracts.tenantId, contracts.externalSaleId],
          set: {
            esiId: sql`excluded.esi_id`,
            supplier: sql`excluded.supplier`,
            supplyType: sql`excluded.supply_type`,
            startDate: sql`excluded.start_date`,
            endDate: sql`excluded.end_date`,
            agentMils: sql`excluded.agent_mils`,
            currency: sql`excluded.currency`,
            fxRate: sql`excluded.fx_rate`,
            pipelineStatus: sql`excluded.pipeline_status`,
            isLive: sql`excluded.is_live`,
            saleType: sql`excluded.sale_type`,
            lostDate: sql`excluded.lost_date`,
            lostReason: sql`excluded.lost_reason`,
            lostBeforeStart: sql`excluded.lost_before_start`,
            lostAfterLive: sql`excluded.lost_after_live`,
            completedPostLive: sql`excluded.completed_post_live`,
            nomination: sql`excluded.nomination`,
            paymentTerm: sql`excluded.payment_term`,
            resoldStatus: sql`excluded.resold_status`,
            isResold: sql`excluded.is_resold`,
            annualUsageKwh: sql`excluded.annual_usage_kwh`,
            grossTcvXlsx: sql`excluded.gross_tcv_xlsx`,
            netTcvXlsx: sql`excluded.net_tcv_xlsx`,
            lostTcv: sql`excluded.lost_tcv`,
            aqLoss: sql`excluded.aq_loss`,
            aqGain: sql`excluded.aq_gain`,
            aqCheck: sql`excluded.aq_check`,
            lostPartial: sql`excluded.lost_partial`,
            updatedAt: sql`now()`,
          },
        })
        .returning({
          id: contracts.id,
          externalSaleId: contracts.externalSaleId,
          inserted: wasInsertedSql,
        }),
    );
    for (const r of result) {
      saleIdToContractId.set(r.externalSaleId!, r.id);
      if (r.inserted) contractInsertedKeys.add(r.externalSaleId!);
    }
  }
  // Per-row tally — see esis pass above for rationale.
  {
    const firstSeen = new Set<string>();
    for (const r of rows) {
      if (!saleIdToContractId.has(r.externalSaleId)) continue;
      if (firstSeen.has(r.externalSaleId)) {
        counts.contracts.updated++;
        continue;
      }
      firstSeen.add(r.externalSaleId);
      if (contractInsertedKeys.has(r.externalSaleId)) counts.contracts.inserted++;
      else counts.contracts.updated++;
    }
  }

  // -------- Pass 5: deals ----------------------------------------------------
  const dealValues = rows
    .map((r) => {
      const customerId = customerMap.get(r.externalCustomerId);
      const contractId = saleIdToContractId.get(r.externalSaleId);
      if (!customerId || !contractId) {
        reportFailure({
          rowNumber: r.rowNumber,
          column: "row",
          header: "load",
          rawValue: "",
          reason: "deal pass: missing customer or contract fk",
          severity: "error",
        });
        return null;
      }
      return {
        tenantId,
        customerId,
        primaryAgentId: opts.agentCache.get(r.primaryAgentName),
        secondaryAgentId: opts.agentCache.get(r.secondaryAgentName),
        contractId,
        externalSaleId: r.externalSaleId,
        saleDate: r.saleDate,
        saleStatus: r.saleStatus,
        objectionStatus: r.objectionStatus,
        objectionType: r.objectionType,
        sourceOfLead: r.sourceOfLead,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
  // Dedup by externalSaleId — multiple xlsx rows sharing a sale id collapse to
  // one deal (last wins). Skip dedup if every externalSaleId already unique.
  const dealByKey = new Map<string, (typeof dealValues)[number]>();
  for (const d of dealValues) dealByKey.set(d.externalSaleId, d);
  const dealUnique = [...dealByKey.values()];
  const dealInsertedKeys = new Set<string>();
  const dealResolvedKeys = new Set<string>();
  for (const chunk of chunked(dealUnique, CHUNK_SIZE)) {
    const result = await withRetry("deals chunk", () =>
      executor
        .insert(deals)
        .values(chunk)
        .onConflictDoUpdate({
          target: [deals.tenantId, deals.externalSaleId],
          set: {
            customerId: sql`excluded.customer_id`,
            primaryAgentId: sql`excluded.primary_agent_id`,
            secondaryAgentId: sql`excluded.secondary_agent_id`,
            contractId: sql`excluded.contract_id`,
            saleDate: sql`excluded.sale_date`,
            saleStatus: sql`excluded.sale_status`,
            objectionStatus: sql`excluded.objection_status`,
            objectionType: sql`excluded.objection_type`,
            sourceOfLead: sql`excluded.source_of_lead`,
            updatedAt: sql`now()`,
          },
        })
        .returning({
          externalSaleId: deals.externalSaleId,
          inserted: wasInsertedSql,
        }),
    );
    for (const r of result) {
      dealResolvedKeys.add(r.externalSaleId!);
      if (r.inserted) dealInsertedKeys.add(r.externalSaleId!);
    }
  }
  // Per-row tally — see esis pass above for rationale.
  {
    const firstSeen = new Set<string>();
    for (const r of rows) {
      if (!dealResolvedKeys.has(r.externalSaleId)) continue;
      if (firstSeen.has(r.externalSaleId)) {
        counts.deals.updated++;
        continue;
      }
      firstSeen.add(r.externalSaleId);
      if (dealInsertedKeys.has(r.externalSaleId)) counts.deals.inserted++;
      else counts.deals.updated++;
    }
  }

  // -------- Pass 6: commission_statements -----------------------------------
  // Dedup by (contract_id, period_start NULL, period_end NULL). Pre-query the
  // contract_ids that already have a null-period statement to know which rows
  // to skip.
  const csCandidates = rows
    .filter((r) =>
      r.receivedAmount !== null ||
      r.outstandingAmount !== null ||
      r.netOutstanding !== null ||
      r.agentCommsPaid !== null ||
      r.agentCommsOutstanding !== null ||
      r.billingAqKwh !== null ||
      r.supplier !== null,
    )
    .map((r) => {
      const contractId = saleIdToContractId.get(r.externalSaleId);
      return contractId ? { row: r, contractId } : null;
    })
    .filter((x): x is { row: TransformedRow; contractId: string } => x !== null);
  const csContractIds = [...new Set(csCandidates.map((x) => x.contractId))];
  const csExisting = new Set<string>();
  for (const chunk of chunked(csContractIds, CHUNK_SIZE)) {
    const found = await withRetry("commission_statements probe", () =>
      executor
        .select({ contractId: commissionStatements.contractId })
        .from(commissionStatements)
        .where(
          and(
            eq(commissionStatements.tenantId, tenantId),
            inArray(commissionStatements.contractId, chunk),
            isNull(commissionStatements.periodStart),
            isNull(commissionStatements.periodEnd),
          ),
        ),
    );
    for (const f of found) csExisting.add(f.contractId);
  }
  const csSeenThisRun = new Set<string>(); // contract_ids inserted in this run
  const csInsertValues: {
    tenantId: string;
    contractId: string;
    supplier: string | null;
    billingAqKwh: string | null;
    mils: string | null;
    receivedAmount: string | null;
    outstandingAmount: string | null;
    netOutstanding: string | null;
    agentCommsPaid: string | null;
    agentCommsOutstanding: string | null;
  }[] = [];
  for (const c of csCandidates) {
    if (csExisting.has(c.contractId) || csSeenThisRun.has(c.contractId)) {
      counts.commission_statements.reused++;
      continue;
    }
    csSeenThisRun.add(c.contractId);
    csInsertValues.push({
      tenantId,
      contractId: c.contractId,
      supplier: c.row.supplier,
      billingAqKwh: c.row.billingAqKwh,
      mils: c.row.agentMils,
      receivedAmount: c.row.receivedAmount,
      outstandingAmount: c.row.outstandingAmount,
      netOutstanding: c.row.netOutstanding,
      agentCommsPaid: c.row.agentCommsPaid,
      agentCommsOutstanding: c.row.agentCommsOutstanding,
    });
  }
  // No retry: commission_statements has no UNIQUE constraint on
  // (contract_id, NULL period_start, NULL period_end), so retry after a
  // transient post-commit disconnect would duplicate rows.
  for (const chunk of chunked(csInsertValues, CHUNK_SIZE)) {
    await executor.insert(commissionStatements).values(chunk);
    counts.commission_statements.inserted += chunk.length;
  }

  // -------- Pass 7: aggregator_payouts --------------------------------------
  // Dedup by (contract_id, aggregator_name, period_start NULL, period_end NULL).
  const apCandidates = rows
    .filter((r) => r.aggregatorName !== null)
    .map((r) => {
      const contractId = saleIdToContractId.get(r.externalSaleId);
      return contractId ? { row: r, contractId } : null;
    })
    .filter((x): x is { row: TransformedRow; contractId: string } => x !== null);
  const apContractIds = [...new Set(apCandidates.map((x) => x.contractId))];
  const apExisting = new Set<string>(); // `${contractId}|${aggregatorName}`
  for (const chunk of chunked(apContractIds, CHUNK_SIZE)) {
    const found = await withRetry("aggregator_payouts probe", () =>
      executor
        .select({
          contractId: aggregatorPayouts.contractId,
          aggregatorName: aggregatorPayouts.aggregatorName,
        })
        .from(aggregatorPayouts)
        .where(
          and(
            eq(aggregatorPayouts.tenantId, tenantId),
            inArray(aggregatorPayouts.contractId, chunk),
            isNull(aggregatorPayouts.periodStart),
            isNull(aggregatorPayouts.periodEnd),
          ),
        ),
    );
    for (const f of found) apExisting.add(`${f.contractId}|${f.aggregatorName}`);
  }
  const apSeenThisRun = new Set<string>();
  const apInsertValues: {
    tenantId: string;
    contractId: string;
    aggregatorName: string;
    aggregatorCommPct: string | null;
  }[] = [];
  for (const c of apCandidates) {
    const key = `${c.contractId}|${c.row.aggregatorName!}`;
    if (apExisting.has(key) || apSeenThisRun.has(key)) {
      counts.aggregator_payouts.reused++;
      continue;
    }
    apSeenThisRun.add(key);
    apInsertValues.push({
      tenantId,
      contractId: c.contractId,
      aggregatorName: c.row.aggregatorName!,
      aggregatorCommPct: c.row.aggregatorCommPct,
    });
  }
  // No retry: same reason as commission_statements — no UNIQUE on
  // (contract_id, aggregator_name, NULL periods) means retry would dupe.
  for (const chunk of chunked(apInsertValues, CHUNK_SIZE)) {
    await executor.insert(aggregatorPayouts).values(chunk);
    counts.aggregator_payouts.inserted += chunk.length;
  }

  // -------- Pass 8: resold links --------------------------------------------
  const resoldLinks = await resolveResoldLinksBulk(executor, opts, rows);

  return {
    counts,
    processedRows: rows.length - failedRowNumbers.size,
    failedRows: failedRowNumbers.size,
    resoldLinks,
  };
}

async function resolveResoldLinksBulk(
  executor: TxLike,
  opts: LoadOpts,
  rows: readonly TransformedRow[],
): Promise<{ linked: number; missing: number }> {
  const { tenantId, saleIdToContractId } = opts;
  // Build child/source pairs; resolve any missing source ids via one bulk
  // SELECT, then one bulk UPDATE per chunk via FROM (VALUES) join.
  type Pair = { childId: string; sourceId: string };
  const pairs: Pair[] = [];
  let missing = 0;

  // First, collect rows with a resoldSaleId and find ones whose source isn't
  // already in the saleIdToContractId map. Probe the DB for those in one pass.
  const unresolved = new Set<string>(); // resoldSaleIds missing from map
  for (const r of rows) {
    if (!r.resoldSaleId) continue;
    if (!saleIdToContractId.has(r.resoldSaleId)) unresolved.add(r.resoldSaleId);
  }
  if (unresolved.size > 0) {
    for (const chunk of chunked([...unresolved], CHUNK_SIZE)) {
      const found = await withRetry("resold probe", () =>
        executor
          .select({ id: contracts.id, externalSaleId: contracts.externalSaleId })
          .from(contracts)
          .where(
            and(
              eq(contracts.tenantId, tenantId),
              inArray(contracts.externalSaleId, chunk),
            ),
          ),
      );
      for (const f of found) {
        if (f.externalSaleId) saleIdToContractId.set(f.externalSaleId, f.id);
      }
    }
  }
  // Dedup by childId — if the same external_sale_id row references different
  // resoldSaleIds across xlsx rows (corrupt data, but possible), the SQL
  // standard says UPDATE ... FROM (VALUES) with duplicate join keys is
  // implementation-defined. Last write wins explicitly here.
  const pairByChild = new Map<string, string>(); // childId → sourceId
  for (const r of rows) {
    if (!r.resoldSaleId) continue;
    const childId = saleIdToContractId.get(r.externalSaleId);
    const sourceId = saleIdToContractId.get(r.resoldSaleId);
    if (!childId || !sourceId) {
      missing++;
      continue;
    }
    pairByChild.set(childId, sourceId);
  }
  for (const [childId, sourceId] of pairByChild) {
    pairs.push({ childId, sourceId });
  }

  let linked = 0;
  // One UPDATE...FROM (VALUES (...)) per chunk. Casts the VALUES to uuid so PG
  // can compare against contracts.id without per-row coercion. UPDATE is
  // idempotent (same SET each retry), so withRetry is safe here.
  for (const chunk of chunked(pairs, CHUNK_SIZE)) {
    const tuples = sql.join(
      chunk.map((p) => sql`(${p.childId}::uuid, ${p.sourceId}::uuid)`),
      sql`, `,
    );
    const result = await withRetry("resold link chunk", () =>
      executor.execute(sql`
        UPDATE contracts
           SET resold_from_contract_id = src.source_id,
               is_resold = true,
               updated_at = now()
          FROM (VALUES ${tuples}) AS src(child_id, source_id)
         WHERE contracts.id = src.child_id
        RETURNING contracts.id
      `),
    );
    // postgres-js returns rows directly on .execute(); .length = rowCount.
    linked += (result as unknown as { length: number }).length;
  }

  return { linked, missing };
}
