import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { jsonError } from "../lib/errors";
import { getDb } from "../get-db";
import {
  createCommissionStatement,
  decodeCursor,
  deleteCommissionStatement,
  getCommissionStatementById,
  listCommissionStatements,
  updateCommissionStatement,
} from "../../db/queries/commission-statements";
import type { HonoEnv } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Body parse + Zod validate. Returns `{ ok: true, data }` on success or
// `{ ok: false, response }` carrying the right `jsonError` so handlers can
// just `return r.response`. Hono's built-in `c.req.json()` throws on invalid
// JSON; we surface that as 400 VALIDATION instead of letting it propagate.
async function readJsonBody<T>(
  c: Context<HonoEnv>,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, response: jsonError(c, 400, "VALIDATION", { body: "invalid JSON" }) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: jsonError(c, 400, "VALIDATION", parsed.error.flatten()) };
  }
  return { ok: true, data: parsed.data };
}

// Postgres `numeric` is lossless when transported as a string. Accept either a
// JSON number (coerce) or string but always validate via regex so trailing
// garbage like "12.34abc" is rejected at the boundary. Negative values OK —
// outstandingAmount can be negative (overpayment).
const numericString = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? String(v) : v))
  .refine((v) => /^-?\d+(\.\d+)?$/.test(v), { message: "must be a decimal" });

// ISO date (YYYY-MM-DD) — Postgres `date` columns. Loose `.refine` rather than
// `z.coerce.date()` so we don't silently accept timestamps that would lose the
// time portion on store.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  contractId: z.string().regex(UUID_RE).optional(),
  supplier: z.string().min(1).max(255).optional(),
  statementBatchId: z.string().regex(UUID_RE).optional(),
});

// Writable fields only. `expectedAmount` and `reconciliationStatus` are
// `GENERATED ALWAYS AS (...) STORED` — Postgres rejects writes to them. We
// strip via `.strict()` so callers learn at the boundary, not at INSERT time.
const CreateBody = z
  .object({
    contractId: z.string().regex(UUID_RE),
    statementBatchId: z.string().regex(UUID_RE).nullish(),
    supplier: z.string().min(1).max(255).nullish(),
    periodStart: isoDate.nullish(),
    periodEnd: isoDate.nullish(),
    pdfStoragePath: z.string().min(1).max(2048).nullish(),
    billingAqKwh: numericString.nullish(),
    mils: numericString.nullish(),
    receivedAmount: numericString.nullish(),
    outstandingAmount: numericString.nullish(),
    netOutstanding: numericString.nullish(),
    agentCommsPaid: numericString.nullish(),
    agentCommsOutstanding: numericString.nullish(),
  })
  .strict();

const UpdateBody = CreateBody.partial().strict();

export const commissionStatementsRoutes = new Hono<HonoEnv>()
  .get("/", async (c) => {
    const parsed = ListQuery.safeParse({
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
      contractId: c.req.query("contractId"),
      supplier: c.req.query("supplier"),
      statementBatchId: c.req.query("statementBatchId"),
    });
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const { limit, cursor: raw, contractId, supplier, statementBatchId } = parsed.data;
    const cursor = raw ? decodeCursor(raw) : null;
    if (raw && !cursor) {
      return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
    }

    const page = await listCommissionStatements(getDb(c), c.get("tenantId"), {
      limit,
      cursor,
      filters: { contractId, supplier, statementBatchId },
    });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Malformed UUIDs answered with 404 (not 400) to avoid leaking that the
    // shape was wrong — caller can't distinguish "no row" from "bad input".
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getCommissionStatementById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    const body = await readJsonBody(c, CreateBody);
    if (!body.ok) return body.response;
    const row = await createCommissionStatement(
      getDb(c),
      c.get("tenantId"),
      body.data,
    );
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const body = await readJsonBody(c, UpdateBody);
    if (!body.ok) return body.response;
    const row = await updateCommissionStatement(
      getDb(c),
      c.get("tenantId"),
      id,
      body.data,
    );
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteCommissionStatement(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
