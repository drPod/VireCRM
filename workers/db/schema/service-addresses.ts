import { pgTable, text, uuid, index } from "drizzle-orm/pg-core";
import {
  createdAt,
  id,
  tenantId,
  tenantIsolationPolicy,
  updatedAt,
} from "./_helpers";
import { customers } from "./customers";

export const serviceAddresses = pgTable(
  "service_addresses",
  {
    id: id(),
    tenantId: tenantId(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    streetNo: text("street_no"),
    streetName: text("street_name"),
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    county: text("county"),
    govtArea: text("govt_area"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("service_addresses_tenant_idx").on(t.tenantId, t.id),
    index("service_addresses_tenant_created_idx").on(
      t.tenantId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    index("service_addresses_tenant_customer_created_idx").on(
      t.tenantId,
      t.customerId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    tenantIsolationPolicy("service_addresses"),
  ],
).enableRLS();
