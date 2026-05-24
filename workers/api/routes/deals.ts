import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { jsonError } from "../lib/errors";
import { getDb } from "../get-db";
import {
  createDeal,
  decodeCursor,
  deleteDeal,
  getDealById,
  listDeals,
  updateDeal,
} from "../../db/queries/deals";
import type { HonoEnv } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.string().regex(UUID_RE);

// `.strict()` on every schema: unknown keys 400 instead of silent-drop. Typos
// like `primmaryAgentId` should fail loudly, not no-op.
//
// Free-text on stage + saleStatus (filter values come from the caller and
// match raw column contents; we don't gate on a fixed enum because the
// pipeline-stage vocabulary is broker-tunable).
const ListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).max(512).optional(),
    customerId: uuid.optional(),
    primaryAgentId: uuid.optional(),
    secondaryAgentId: uuid.optional(),
    stage: z.string().min(1).max(128).optional(),
    saleStatus: z.string().min(1).max(64).optional(),
  })
  .strict();

// `primaryAgentId` required at the API boundary (dual-agent rule: every deal
// must carry a primary, secondary is optional). Schema column is nullable
// because `onDelete: set null` clears it when an agent is deleted; the API
// gate keeps the rule enforced for newly-created deals.
const CreateBody = z
  .object({
    customerId: uuid,
    primaryAgentId: uuid,
    secondaryAgentId: uuid.nullish(),
    contractId: uuid.nullish(),
    name: z.string().min(1).max(256).nullish(),
    externalSaleId: z.string().min(1).max(128).nullish(),
    // `z.iso.date()` validates a real calendar date (rejects 2026-13-99,
    // 2026-02-30, etc.) — the regex form only checks shape.
    saleDate: z.iso.date().nullish(),
    stage: z.string().min(1).max(128).optional(),
    saleStatus: z.string().min(1).max(64).nullish(),
    objectionStatus: z.string().min(1).max(64).nullish(),
    objectionType: z.string().min(1).max(128).nullish(),
    sourceOfLead: z.string().min(1).max(128).nullish(),
  })
  .strict();

// PATCH = CreateBody with every field optional, plus a `.refine` that rejects
// `{}` so an empty body returns 400 VALIDATION instead of silently writing
// nothing (or hitting Drizzle's `UPDATE … SET WHERE` syntax error).
const UpdateBody = CreateBody.partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "patch must include at least one field",
  });

async function readJson(c: Context<HonoEnv>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

// `postgres-js` throws `PostgresError` with `code` + `constraint_name` set on
// unique violations. Narrow via duck typing instead of `instanceof` to avoid
// pulling the postgres-js value into this file — only the driver constructs it.
function isUniqueViolation(err: unknown, constraint: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; code?: string; constraint_name?: string };
  return e.name === "PostgresError" && e.code === "23505" && e.constraint_name === constraint;
}

export const dealsRoutes = new Hono<HonoEnv>()
  .get("/", async (c) => {
    const parsed = ListQuery.safeParse({
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
      customerId: c.req.query("customerId"),
      primaryAgentId: c.req.query("primaryAgentId"),
      secondaryAgentId: c.req.query("secondaryAgentId"),
      stage: c.req.query("stage"),
      saleStatus: c.req.query("saleStatus"),
    });
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const { limit, cursor: raw, ...filters } = parsed.data;
    const cursor = raw ? decodeCursor(raw) : null;
    if (raw && !cursor) {
      return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
    }

    const page = await listDeals(getDb(c), c.get("tenantId"), {
      limit,
      cursor,
      filters,
    });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Malformed UUID and missing row are indistinguishable to the caller —
    // 404 (not 400) so we don't leak format-vs-existence.
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getDealById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    const body = await readJson(c);
    if (body === null) {
      return jsonError(c, 400, "VALIDATION", { body: "invalid json" });
    }
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    try {
      const row = await createDeal(getDb(c), c.get("tenantId"), parsed.data);
      return c.json(row, 201);
    } catch (err) {
      // Schema has `uniqueIndex("deals_tenant_external_sale_idx").on(tenantId,
      // externalSaleId)`; without this catch a duplicate POST would 500.
      if (isUniqueViolation(err, "deals_tenant_external_sale_idx")) {
        return jsonError(c, 409, "CONFLICT", {
          externalSaleId: "already exists for this tenant",
        });
      }
      throw err;
    }
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const body = await readJson(c);
    if (body === null) {
      return jsonError(c, 400, "VALIDATION", { body: "invalid json" });
    }
    const parsed = UpdateBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const row = await updateDeal(getDb(c), c.get("tenantId"), id, parsed.data);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteDeal(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
