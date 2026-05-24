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

// Free-text on stage + saleStatus (filter values come from the caller and
// match raw column contents; we don't gate on a fixed enum because the
// pipeline-stage vocabulary is broker-tunable).
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  customerId: uuid.optional(),
  primaryAgentId: uuid.optional(),
  secondaryAgentId: uuid.optional(),
  stage: z.string().min(1).max(128).optional(),
  saleStatus: z.string().min(1).max(64).optional(),
});

// `primaryAgentId` required at the API boundary (dual-agent rule: every deal
// must carry a primary, secondary is optional). Schema column is nullable
// because `onDelete: set null` clears it when an agent is deleted; the API
// gate keeps the rule enforced for newly-created deals.
const CreateBody = z.object({
  customerId: uuid,
  primaryAgentId: uuid,
  secondaryAgentId: uuid.nullish(),
  contractId: uuid.nullish(),
  name: z.string().min(1).max(256).nullish(),
  externalSaleId: z.string().min(1).max(128).nullish(),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  stage: z.string().min(1).max(128).optional(),
  saleStatus: z.string().min(1).max(64).nullish(),
  objectionStatus: z.string().min(1).max(64).nullish(),
  objectionType: z.string().min(1).max(128).nullish(),
  sourceOfLead: z.string().min(1).max(128).nullish(),
});

// PATCH = CreateBody with every field optional. `primaryAgentId` becomes
// `uuid | undefined` (still not nullable — the dual-agent rule means a deal
// can never have a null primary). `secondaryAgentId` stays `nullish` from
// the shape it inherits, so callers can clear it explicitly by passing null.
const UpdateBody = CreateBody.partial();

async function readJson(c: Context<HonoEnv>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
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

    const row = await createDeal(getDb(c), c.get("tenantId"), parsed.data);
    return c.json(row, 201);
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
