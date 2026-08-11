import { Hono } from "hono";
import { z } from "zod";
import { jsonError } from "../lib/errors";
import { getDb } from "../get-db";
import {
  createAgent,
  decodeCursor,
  deleteAgent,
  getAgentById,
  listAgents,
  updateAgent,
} from "../../db/queries/agents";
import type { HonoEnv } from "../types";

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// NUMERIC(5,2), 0–100.
const HouseSplitPct = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v))
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100, {
    message: "must be 0-100 with at most 2 decimal places",
  });

const CreateBody = z
  .object({
    name: z.string().trim().min(1).max(255),
    email: z.string().trim().email().max(255).nullish(),
    houseSplitPct: HouseSplitPct.nullish(),
  })
  .strict();

const UpdateBody = CreateBody.partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field required" });

// Same duck-typing as deals.ts: real PostgresError sits at `.cause`.
function isUniqueViolation(err: unknown, constraint: string): boolean {
  const candidate = (err as { cause?: unknown })?.cause ?? err;
  if (typeof candidate !== "object" || candidate === null) return false;
  const e = candidate as { code?: string; constraint_name?: string };
  return e.code === "23505" && e.constraint_name === constraint;
}

const EMAIL_CONFLICT = { email: "already exists for this tenant" };

export const agentsRoutes = new Hono<HonoEnv>()
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

    const page = await listAgents(getDb(c), c.get("tenantId"), { limit, cursor });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Malformed UUIDs answer 404 (not 400) — same rationale as customers.ts.
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getAgentById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body === null) return jsonError(c, 400, "VALIDATION", { body: "invalid JSON" });
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    try {
      const row = await createAgent(getDb(c), c.get("tenantId"), parsed.data);
      return c.json(row, 201);
    } catch (err) {
      if (isUniqueViolation(err, "agents_tenant_email_idx")) {
        return jsonError(c, 409, "CONFLICT", EMAIL_CONFLICT);
      }
      throw err;
    }
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const body = await c.req.json().catch(() => null);
    if (body === null) return jsonError(c, 400, "VALIDATION", { body: "invalid JSON" });
    const parsed = UpdateBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    try {
      const row = await updateAgent(getDb(c), c.get("tenantId"), id, parsed.data);
      if (!row) return jsonError(c, 404, "NOT_FOUND");
      return c.json(row);
    } catch (err) {
      if (isUniqueViolation(err, "agents_tenant_email_idx")) {
        return jsonError(c, 409, "CONFLICT", EMAIL_CONFLICT);
      }
      throw err;
    }
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteAgent(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
