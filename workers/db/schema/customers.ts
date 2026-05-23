import {
  pgTable,
  text,
  numeric,
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

export const customers = pgTable(
  "customers",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    externalCustomerId: text("external_customer_id"),
    primaryContactName: text("primary_contact_name"),
    primaryTitle: text("primary_title"),
    primaryEmail: text("primary_email"),
    primaryPhone: text("primary_phone"),
    notes: text("notes"),
    sicCode: text("sic_code"),
    businessType: text("business_type"),
    category: text("category"),
    region: text("region"),
    county: text("county"),
    creditScore: numeric("credit_score", { precision: 6, scale: 0 }),
    annualRevenue: numeric("annual_revenue", { precision: 20, scale: 2 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("customers_tenant_idx").on(t.tenantId, t.id),
    index("customers_tenant_created_idx").on(
      t.tenantId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    uniqueIndex("customers_tenant_external_idx").on(
      t.tenantId,
      t.externalCustomerId,
    ),
    tenantIsolationPolicy("customers"),
  ],
).enableRLS();
