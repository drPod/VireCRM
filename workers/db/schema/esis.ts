import { pgTable, text, uuid, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  createdAt,
  id,
  tenantId,
  tenantIsolationPolicy,
  updatedAt,
} from "./_helpers";
import { serviceAddresses } from "./service-addresses";

export const esis = pgTable(
  "esis",
  {
    id: id(),
    tenantId: tenantId(),
    serviceAddressId: uuid("service_address_id")
      .notNull()
      .references(() => serviceAddresses.id, { onDelete: "cascade" }),
    esiId: text("esi_id").notNull(),
    physicalMeterSerial: text("physical_meter_serial"),
    eacKwh: numeric("eac_kwh", { precision: 20, scale: 4 }),
    billingAqKwh: numeric("billing_aq_kwh", { precision: 20, scale: 4 }),
    annualUsageKwh: numeric("annual_usage_kwh", { precision: 20, scale: 4 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("esis_tenant_idx").on(t.tenantId, t.id),
    uniqueIndex("esis_tenant_esi_id_idx").on(t.tenantId, t.esiId),
    index("esis_tenant_service_address_idx").on(t.tenantId, t.serviceAddressId),
    tenantIsolationPolicy("esis"),
  ],
).enableRLS();
