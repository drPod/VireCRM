import { Hono } from "hono";
import { z } from "zod";
import { jsonError } from "../lib/errors";
import { getDb } from "../get-db";
import {
  createEsi,
  decodeCursor,
  deleteEsi,
  getEsiById,
  listEsis,
  updateEsi,
} from "../../db/queries/esis";
import type { HonoEnv } from "../types";

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  customerId: z.uuid().optional(),
  serviceAddressId: z.uuid().optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ESI ID = 17–22 digits per the domain glossary. Migration bypasses this route.
const EsiIdSchema = z.string().regex(/^\d{17,22}$/, "expected 17-22 digits");

const NUMERIC_20_4_RE = /^-?\d{1,16}(?:\.\d{1,4})?$/;

// kWh columns are NUMERIC(20,4); accept string or number, pass string to driver.
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

const CreateBody = z
  .object({
    serviceAddressId: z.uuid(),
    esiId: EsiIdSchema,
    physicalMeterSerial: z.string().min(1).max(64).nullish(),
    eacKwh: NumericKwhSchema.nullish(),
    billingAqKwh: NumericKwhSchema.nullish(),
    annualUsageKwh: NumericKwhSchema.nullish(),
  })
  .strict();

// esiId absent: immutable post-creation; re-keying = delete + insert.
const UpdateBody = z
  .object({
    serviceAddressId: z.uuid(),
    physicalMeterSerial: z.string().min(1).max(64).nullable(),
    eacKwh: NumericKwhSchema.nullable(),
    billingAqKwh: NumericKwhSchema.nullable(),
    annualUsageKwh: NumericKwhSchema.nullable(),
  })
  .partial()
  .strict();

// Same duck-typing as deals.ts: real PostgresError sits at `.cause`.
function isUniqueViolation(err: unknown, constraint: string): boolean {
  const candidate = (err as { cause?: unknown })?.cause ?? err;
  if (typeof candidate !== "object" || candidate === null) return false;
  const e = candidate as { code?: string; constraint_name?: string };
  return e.code === "23505" && e.constraint_name === constraint;
}

export const esisRoutes = new Hono<HonoEnv>()
  .get("/", async (c) => {
    const parsed = ListQuery.safeParse({
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
      customerId: c.req.query("customerId"),
      serviceAddressId: c.req.query("serviceAddressId"),
    });
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const { limit, cursor: raw, customerId, serviceAddressId } = parsed.data;
    const cursor = raw ? decodeCursor(raw) : null;
    if (raw && !cursor) {
      return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
    }

    const page = await listEsis(getDb(c), c.get("tenantId"), {
      limit,
      cursor,
      filters: { customerId, serviceAddressId },
    });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Malformed UUIDs answer 404 (not 400) — same rationale as customers.ts.
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getEsiById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    const json = await c.req.json().catch(() => null);
    if (json === null) return jsonError(c, 400, "VALIDATION", { body: "invalid JSON" });
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    try {
      const row = await createEsi(getDb(c), c.get("tenantId"), parsed.data);
      // null = serviceAddressId missing or cross-tenant; same answer for both.
      if (!row) return jsonError(c, 400, "VALIDATION", { serviceAddressId: "unknown" });
      return c.json(row, 201);
    } catch (err) {
      if (isUniqueViolation(err, "esis_tenant_esi_id_idx")) {
        return jsonError(c, 409, "CONFLICT", { esiId: "already exists for this tenant" });
      }
      throw err;
    }
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const json = await c.req.json().catch(() => null);
    if (json === null) return jsonError(c, 400, "VALIDATION", { body: "invalid JSON" });
    const parsed = UpdateBody.safeParse(json);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    // null covers row-not-found AND cross-tenant re-parent target; both 404.
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
