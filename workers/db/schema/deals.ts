import { pgTable, text, uuid, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  createdAt,
  id,
  tenantId,
  tenantIsolationPolicy,
  updatedAt,
} from "./_helpers";
import { customers } from "./customers";
import { contracts } from "./contracts";
import { agents } from "./agents";

export const deals = pgTable(
  "deals",
  {
    id: id(),
    tenantId: tenantId(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    primaryAgentId: uuid("primary_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    secondaryAgentId: uuid("secondary_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    contractId: uuid("contract_id").references(() => contracts.id, {
      onDelete: "set null",
    }),
    name: text("name"),
    externalSaleId: text("external_sale_id"),
    saleDate: date("sale_date"),
    stage: text("stage").notNull().default("Lead"),
    saleStatus: text("sale_status"),
    objectionStatus: text("objection_status"),
    objectionType: text("objection_type"),
    sourceOfLead: text("source_of_lead"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("deals_tenant_idx").on(t.tenantId, t.id),
    index("deals_tenant_customer_idx").on(t.tenantId, t.customerId),
    index("deals_tenant_stage_idx").on(t.tenantId, t.stage),
    uniqueIndex("deals_tenant_external_sale_idx").on(t.tenantId, t.externalSaleId),
    tenantIsolationPolicy("deals"),
  ],
).enableRLS();
