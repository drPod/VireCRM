import { index, numeric, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, id, tenantId, tenantIsolationPolicy, updatedAt } from "./_helpers";

export const agents = pgTable(
  "agents",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    email: text("email"),
    houseSplitPct: numeric("house_split_pct", { precision: 5, scale: 2 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("agents_tenant_idx").on(t.tenantId, t.id),
    index("agents_tenant_created_idx").on(t.tenantId, t.createdAt.desc(), t.id.desc()),
    uniqueIndex("agents_tenant_email_idx").on(t.tenantId, t.email),
    tenantIsolationPolicy("agents"),
  ],
).enableRLS();
