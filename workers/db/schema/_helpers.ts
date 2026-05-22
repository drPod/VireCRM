import { sql } from "drizzle-orm";
import { pgPolicy, uuid, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);

export const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" });

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const tenantIsolationPolicy = (tableName: string) =>
  pgPolicy(`${tableName}_tenant_isolation`, {
    as: "permissive",
    for: "all",
    to: "authenticated",
    using: sql`tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)`,
    withCheck: sql`tenant_id = ((SELECT auth.jwt() ->> 'tenant_id')::uuid)`,
  });
