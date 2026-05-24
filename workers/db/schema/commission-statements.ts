import { sql, type SQL } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  numeric,
  date,
  index,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  id,
  tenantId,
  tenantIsolationPolicy,
  updatedAt,
} from "./_helpers";
import { contracts } from "./contracts";

export const commissionStatements = pgTable(
  "commission_statements",
  {
    id: id(),
    tenantId: tenantId(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    // Soft REP payout-batch tag. No `statement_batches` table — Doc 06
    // §CommissionStatements treats this as a free-form grouping label, not
    // a relation, so no FK reference.
    statementBatchId: uuid("statement_batch_id"),
    supplier: text("supplier"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    pdfStoragePath: text("pdf_storage_path"),
    billingAqKwh: numeric("billing_aq_kwh", { precision: 20, scale: 4 }),
    mils: numeric("mils", { precision: 12, scale: 3 }),
    expectedAmount: numeric("expected_amount", { precision: 20, scale: 2 })
      .generatedAlwaysAs(
        (): SQL => sql`${commissionStatements.billingAqKwh} * ${commissionStatements.mils} / 1000`,
      ),
    receivedAmount: numeric("received_amount", { precision: 20, scale: 2 }),
    outstandingAmount: numeric("outstanding_amount", { precision: 20, scale: 2 }),
    netOutstanding: numeric("net_outstanding", { precision: 20, scale: 2 }),
    agentCommsPaid: numeric("agent_comms_paid", { precision: 20, scale: 2 }),
    agentCommsOutstanding: numeric("agent_comms_outstanding", {
      precision: 20,
      scale: 2,
    }),
    reconciliationStatus: text("reconciliation_status").generatedAlwaysAs(
      (): SQL => sql`CASE
        WHEN ${commissionStatements.billingAqKwh} IS NULL OR ${commissionStatements.mils} IS NULL THEN 'unknown'
        WHEN ${commissionStatements.receivedAmount} IS NULL THEN 'pending'
        WHEN ABS(${commissionStatements.receivedAmount} - (${commissionStatements.billingAqKwh} * ${commissionStatements.mils} / 1000)) < 0.01 THEN 'matched'
        WHEN ${commissionStatements.receivedAmount} < (${commissionStatements.billingAqKwh} * ${commissionStatements.mils} / 1000) THEN 'short'
        ELSE 'over'
      END`,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("commission_statements_tenant_idx").on(t.tenantId, t.id),
    index("commission_statements_tenant_contract_idx").on(t.tenantId, t.contractId),
    index("commission_statements_tenant_period_idx").on(
      t.tenantId,
      t.periodStart,
    ),
    tenantIsolationPolicy("commission_statements"),
  ],
).enableRLS();
