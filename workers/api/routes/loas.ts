import { Hono } from "hono";
import { z } from "zod";
import { jsonError } from "../lib/errors";
import { getDb } from "../get-db";
import {
  UnknownCustomerError,
  createLoa,
  decodeCursor,
  deleteLoa,
  getLoaById,
  listLoas,
  updateLoa,
} from "../../db/queries/loas";
import type { HonoEnv } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  customerId: z.string().regex(UUID_RE).optional(),
});

// Dates accepted as ISO `YYYY-MM-DD` (Postgres `date` column). Stored verbatim;
// timezone normalization is not this layer's job. Empty string treated as
// "absent" to match form-data conventions on the SPA side.
const DateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
  .nullable();

const PdfPathField = z.string().min(1).max(1024).nullable();

const CreateBody = z.object({
  customerId: z.string().regex(UUID_RE),
  pdfStoragePath: PdfPathField.optional(),
  signedDate: DateField.optional(),
  expirationDate: DateField.optional(),
});

// All fields optional on PATCH so callers can clear nullable columns by sending
// `null`. Empty `{}` is a no-op (touches `updated_at` only) which is fine — a
// caller doing this on purpose is rare but harmless.
const UpdateBody = z.object({
  customerId: z.string().regex(UUID_RE).optional(),
  pdfStoragePath: PdfPathField.optional(),
  signedDate: DateField.optional(),
  expirationDate: DateField.optional(),
});

export const loasRoutes = new Hono<HonoEnv>()
  .get("/", async (c) => {
    const parsed = ListQuery.safeParse({
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
      customerId: c.req.query("customerId"),
    });
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const { limit, cursor: raw, customerId } = parsed.data;
    const cursor = raw ? decodeCursor(raw) : null;
    if (raw && !cursor) {
      return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
    }

    const page = await listLoas(getDb(c), c.get("tenantId"), {
      limit,
      cursor,
      customerId,
    });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Validate the path param before hitting Postgres — an `id` that doesn't
    // match the UUID shape would throw at the driver. We answer 404 (not 400)
    // because malformed IDs and missing rows are indistinguishable to the
    // caller, and 400 would leak that the format was wrong.
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getLoaById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return jsonError(c, 400, "VALIDATION", { body: "invalid JSON" });
    }
    const parsed = CreateBody.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    // Cross-tenant customerId (or unknown UUID) → 400 `customerId: unknown`.
    // Postgres FK checks bypass RLS, so createLoa runs an RLS-scoped SELECT
    // against `customers` first and throws `UnknownCustomerError` when the
    // row is invisible from this tenant's perspective.
    try {
      const row = await createLoa(getDb(c), c.get("tenantId"), parsed.data);
      return c.json(row, 201);
    } catch (err) {
      if (err instanceof UnknownCustomerError) {
        return jsonError(c, 400, "VALIDATION", { customerId: "unknown" });
      }
      throw err;
    }
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return jsonError(c, 400, "VALIDATION", { body: "invalid JSON" });
    }
    const parsed = UpdateBody.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    try {
      const row = await updateLoa(getDb(c), c.get("tenantId"), id, parsed.data);
      if (!row) return jsonError(c, 404, "NOT_FOUND");
      return c.json(row);
    } catch (err) {
      if (err instanceof UnknownCustomerError) {
        return jsonError(c, 400, "VALIDATION", { customerId: "unknown" });
      }
      throw err;
    }
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteLoa(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
