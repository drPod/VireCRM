import { Hono } from "hono";
import { z } from "zod";
import {
  createCustomer,
  decodeCursor,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} from "../../db/queries/customers";
import { getDb } from "../get-db";
import { jsonError } from "../lib/errors";
import type { HonoEnv } from "../types";

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
});

// Body schemas omit server-controlled fields (`id`, `tenantId`, timestamps);
// `tenantId` is forced from the JWT context in the query layer. `null` is
// accepted on PATCH to clear nullable columns; on POST the DB default takes
// over when the key is absent.
const nullableStr = z.string().max(1024).nullable().optional();
// RFC 5321 caps the local-part + domain at 254 chars combined.
const emailField = z.string().email().max(254).nullable().optional();
// `creditScore` is `numeric(6,0)` — fits in JS's 2^53 safe-int range, so a JS
// number input is lossless. Accept number or digit-string; coerce to string for
// Drizzle's `numeric` driver shape.
const creditScoreField = z
  .union([z.number().int().safe(), z.string().regex(/^\d+$/)])
  .transform((v) => (typeof v === "number" ? String(v) : v))
  .nullable()
  .optional();

// `annualRevenue` is `numeric(20,2)` — 20 digits exceeds JS's IEEE-754 safe
// range, and `JSON.parse` already lost precision by the time we see a number.
// Require a decimal string so the caller's exact value reaches Postgres.
const annualRevenueField = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .nullable()
  .optional();

const customerBodyShape = {
  externalCustomerId: nullableStr,
  primaryContactName: nullableStr,
  primaryTitle: nullableStr,
  primaryEmail: emailField,
  primaryPhone: nullableStr,
  notes: nullableStr,
  sicCode: nullableStr,
  businessType: nullableStr,
  category: nullableStr,
  region: nullableStr,
  county: nullableStr,
  creditScore: creditScoreField,
  annualRevenue: annualRevenueField,
} as const;

const CreateCustomerBody = z
  .object({ name: z.string().min(1).max(512), ...customerBodyShape })
  .strict();

const UpdateCustomerBody = z
  .object({ name: z.string().min(1).max(512).optional(), ...customerBodyShape })
  .strict();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Distinguish a malformed JSON body from one that legitimately parsed to `null`
// or anything else Zod will reject. Without this both cases fall through to a
// confusing `"Expected object, received null"` flatten output.
const INVALID_JSON = Symbol("invalid-json");

async function readJsonBody(c: {
  req: { json(): Promise<unknown> };
}): Promise<unknown | typeof INVALID_JSON> {
  return c.req.json().catch(() => INVALID_JSON);
}

export const customersRoutes = new Hono<HonoEnv>()
  .get("/", async (c) => {
    const parsed = ListQuery.safeParse({
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
    });
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const { limit, cursor: raw } = parsed.data;
    const cursor = raw ? decodeCursor(raw) : null;
    if (raw && !cursor) {
      return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
    }

    const page = await listCustomers(getDb(c), c.get("tenantId"), { limit, cursor });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Validate the path param before hitting Postgres — an `id` that doesn't
    // match the UUID shape would throw at the driver. We answer 404 (not 400)
    // because malformed IDs and missing rows are indistinguishable to the
    // caller, and 400 would leak that the format was wrong.
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getCustomerById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    const body = await readJsonBody(c);
    if (body === INVALID_JSON) return jsonError(c, 400, "VALIDATION", { body: "invalid JSON" });
    const parsed = CreateCustomerBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }
    const row = await createCustomer(getDb(c), c.get("tenantId"), parsed.data);
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const body = await readJsonBody(c);
    if (body === INVALID_JSON) return jsonError(c, 400, "VALIDATION", { body: "invalid JSON" });
    const parsed = UpdateCustomerBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }
    const row = await updateCustomer(getDb(c), c.get("tenantId"), id, parsed.data);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteCustomer(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
