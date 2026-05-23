import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  pgTable,
  text,
  uuid,
  numeric,
  date,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  id,
  tenantId,
  tenantIsolationPolicy,
  updatedAt,
} from "./_helpers";
import { esis } from "./esis";

export const contracts = pgTable(
  "contracts",
  {
    id: id(),
    tenantId: tenantId(),
    esiId: uuid("esi_id")
      .notNull()
      .references(() => esis.id, { onDelete: "restrict" }),
    externalSaleId: text("external_sale_id"),
    supplier: text("supplier"),
    supplyType: text("supply_type"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    costPerKwh: numeric("cost_per_kwh", { precision: 12, scale: 6 }),
    agentMils: numeric("agent_mils", { precision: 12, scale: 3 }),
    currency: text("currency").notNull().default("USD"),
    fxRate: numeric("fx_rate", { precision: 12, scale: 6 }).notNull().default("1.0"),
    pipelineStatus: text("pipeline_status").notNull().default("pending"),
    isLive: boolean("is_live").notNull().default(false),
    saleType: text("sale_type"),
    lostDate: date("lost_date"),
    lostReason: text("lost_reason"),
    lostBeforeStart: boolean("lost_before_start").notNull().default(false),
    lostAfterLive: boolean("lost_after_live").notNull().default(false),
    completedPostLive: boolean("completed_post_live").notNull().default(false),
    dropDate: date("drop_date"),
    dropReason: text("drop_reason"),
    nomination: text("nomination"),
    paymentTerm: text("payment_term"),
    resoldStatus: text("resold_status"),
    isResold: boolean("is_resold").notNull().default(false),
    resoldFromContractId: uuid("resold_from_contract_id").references(
      (): AnyPgColumn => contracts.id,
      { onDelete: "set null" },
    ),
    annualUsageKwh: numeric("annual_usage_kwh", { precision: 20, scale: 4 }),
    grossTcv: numeric("gross_tcv", { precision: 20, scale: 2 }).generatedAlwaysAs(
      (): SQL => sql`COALESCE(${contracts.annualUsageKwh}, 0) * COALESCE((${contracts.endDate} - ${contracts.startDate})::numeric / 365.25, 0) * COALESCE(${contracts.agentMils}, 0) / 1000`,
    ),
    grossTcvXlsx: numeric("gross_tcv_xlsx", { precision: 20, scale: 2 }),
    lostTcv: numeric("lost_tcv", { precision: 20, scale: 2 }),
    netTcv: numeric("net_tcv", { precision: 20, scale: 2 }).generatedAlwaysAs(
      (): SQL => sql`COALESCE(${contracts.annualUsageKwh}, 0) * COALESCE((${contracts.endDate} - ${contracts.startDate})::numeric / 365.25, 0) * COALESCE(${contracts.agentMils}, 0) / 1000 - COALESCE(${contracts.lostTcv}, 0)`,
    ),
    netTcvXlsx: numeric("net_tcv_xlsx", { precision: 20, scale: 2 }),
    aqLoss: numeric("aq_loss", { precision: 20, scale: 4 }),
    aqGain: numeric("aq_gain", { precision: 20, scale: 4 }),
    netAq: numeric("net_aq", { precision: 20, scale: 4 }).generatedAlwaysAs(
      (): SQL => sql`COALESCE(${contracts.aqGain}, 0) - COALESCE(${contracts.aqLoss}, 0)`,
    ),
    aqCheck: numeric("aq_check", { precision: 20, scale: 4 }),
    lostPartial: boolean("lost_partial").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("contracts_tenant_idx").on(t.tenantId, t.id),
    index("contracts_tenant_esi_idx").on(t.tenantId, t.esiId),
    index("contracts_tenant_status_idx").on(t.tenantId, t.pipelineStatus),
    uniqueIndex("contracts_tenant_external_sale_idx").on(t.tenantId, t.externalSaleId),
    tenantIsolationPolicy("contracts"),
  ],
).enableRLS();
