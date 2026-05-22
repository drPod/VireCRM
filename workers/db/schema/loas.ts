import { pgTable, text, uuid, date, index } from "drizzle-orm/pg-core";
import {
  createdAt,
  id,
  tenantId,
  tenantIsolationPolicy,
  updatedAt,
} from "./_helpers";
import { customers } from "./customers";

export const loas = pgTable(
  "loas",
  {
    id: id(),
    tenantId: tenantId(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    pdfStoragePath: text("pdf_storage_path"),
    signedDate: date("signed_date"),
    expirationDate: date("expiration_date"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("loas_tenant_idx").on(t.tenantId, t.id),
    index("loas_tenant_customer_expiration_idx").on(
      t.tenantId,
      t.customerId,
      t.expirationDate,
    ),
    tenantIsolationPolicy("loas"),
  ],
).enableRLS();
