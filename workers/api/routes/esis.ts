import { Hono } from "hono";
import { z } from "zod";
import {
  createEsi,
  decodeCursor,
  deleteEsi,
  getEsiById,
  listEsis,
  updateEsi,
} from "../../db/queries/esis";
import { getDb } from "../get-db";
import { jsonError } from "../lib/errors";
import type { HonoEnv } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Up to 16 integer digits + up to 4 fractional digits — matches NUMERIC(20,4).
const NUMERIC_20_4_RE = /^-?\d{1,16}(?:\.\d{1,4})?$/;

const UuidSchema = z.string().regex(UUID_RE);

// Numeric kWh fields are stored as NUMERIC(20,4) — accept a string or a finite
// number from the client, normalize to a string for the driver. Empty string
// would silently coerce to 0 in Postgres so we reject it at the Zod boundary.
// After the string conversion, we validate the result fits NUMERIC(20,4).
const NumericKwhSchema = z
  .union([
    z
      .string()
      .min(1)
      .regex(/^-?\d+(\.\d+)?$/, "must be a decimal string"),
    z.number().finite(),
  ])
  .transform((v) => (typeof v === "number" ? v.toString() : v))
  .pipe(z.string().regex(NUMERIC_20_4_RE, "must fit NUMERIC(20,4)"));

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  serviceAddressId: UuidSchema.optional(),
});

const CreateBody = z.object({
  serviceAddressId: UuidSchema,
  esiId: z.string().min(1).max(64),
  physicalMeterSerial: z.string().min(1).max(64).nullish(),
  eacKwh: NumericKwhSchema.nullish(),
  billingAqKwh: NumericKwhSchema.nullish(),
  annualUsageKwh: NumericKwhSchema.nullish(),
});

// PATCH body — every field optional. `tenantId` deliberately absent: it's
// forced from the resolved request context inside the query layer and must
// never be writeable from the body. `esiId` is also absent: the ESI ID is the
// canonical universal key (per CLAUDE.md domain glossary) and treated as
// immutable post-creation; re-keying requires delete + insert.
const UpdateBody = z
  .object({
    serviceAddressId: UuidSchema,
    physicalMeterSerial: z.string().min(1).max(64).nullable(),
    eacKwh: NumericKwhSchema.nullable(),
    billingAqKwh: NumericKwhSchema.nullable(),
    annualUsageKwh: NumericKwhSchema.nullable(),
  })
  .partial();

export const esisRoutes = new Hono<HonoEnv>()
  .get("/", async (c) => {
    const parsed = ListQuery.safeParse({
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
      serviceAddressId: c.req.query("serviceAddressId"),
    });
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const { limit, cursor: raw, serviceAddressId } = parsed.data;
    const cursor = raw ? decodeCursor(raw) : null;
    if (raw && !cursor) {
      return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
    }

    const page = await listEsis(getDb(c), c.get("tenantId"), {
      limit,
      cursor,
      serviceAddressId,
    });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Malformed UUID -> 404 (same as miss) so we don't leak the "format was
    // wrong vs row doesn't exist" distinction to the caller.
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getEsiById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    const json = await c.req.json().catch(() => null);
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }
    const row = await createEsi(getDb(c), c.get("tenantId"), parsed.data);
    // `null` = supplied serviceAddressId doesn't belong to the caller's tenant.
    // Return 404 (not 403) to avoid leaking cross-tenant address existence.
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const json = await c.req.json().catch(() => null);
    const parsed = UpdateBody.safeParse(json);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }
    const row = await updateEsi(getDb(c), c.get("tenantId"), id, parsed.data);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteEsi(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
