import { pgTable, text, uuid, numeric, date, index } from "drizzle-orm/pg-core";
import {
  createdAt,
  id,
  tenantId,
  tenantIsolationPolicy,
  updatedAt,
} from "./_helpers";
import { contracts } from "./contracts";

export const aggregatorPayouts = pgTable(
  "aggregator_payouts",
  {
    id: id(),
    tenantId: tenantId(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    aggregatorName: text("aggregator_name").notNull(),
    aggregatorCommPct: numeric("aggregator_comm_pct", {
      precision: 5,
      scale: 2,
    }),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    amount: numeric("amount", { precision: 20, scale: 2 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("aggregator_payouts_tenant_idx").on(t.tenantId, t.id),
    index("aggregator_payouts_tenant_contract_idx").on(
      t.tenantId,
      t.contractId,
    ),
    tenantIsolationPolicy("aggregator_payouts"),
  ],
).enableRLS();
