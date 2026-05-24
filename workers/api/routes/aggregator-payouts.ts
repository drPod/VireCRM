import { Hono } from "hono";
import { z } from "zod";
import { jsonError } from "../lib/errors";
import { getDb } from "../get-db";
import {
  createAggregatorPayout,
  decodeCursor,
  deleteAggregatorPayout,
  getAggregatorPayoutById,
  listAggregatorPayouts,
  updateAggregatorPayout,
} from "../../db/queries/aggregator-payouts";
import type { HonoEnv } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuid = z.string().regex(UUID_RE, "must be a valid uuid");
// Postgres `numeric` is read/written as a string in postgres-js to avoid float
// rounding. Accept the same shape from clients.
const numericStr = z.string().regex(/^-?\d+(\.\d+)?$/, "must be a numeric string");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  contractId: uuid.optional(),
  aggregatorName: z.string().min(1).max(255).optional(),
});

const CreateBody = z.object({
  contractId: uuid,
  aggregatorName: z.string().min(1).max(255),
  aggregatorCommPct: numericStr.nullish(),
  periodStart: dateStr.nullish(),
  periodEnd: dateStr.nullish(),
  amount: numericStr.nullish(),
});

// PATCH: every field optional, but at least one must be present. Without the
// refinement an empty body would round-trip as a touch-`updated_at` no-op.
const PatchBody = z
  .object({
    contractId: uuid.optional(),
    aggregatorName: z.string().min(1).max(255).optional(),
    aggregatorCommPct: numericStr.nullish(),
    periodStart: dateStr.nullish(),
    periodEnd: dateStr.nullish(),
    amount: numericStr.nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field required",
  });

export const aggregatorPayoutsRoutes = new Hono<HonoEnv>()
  .get("/", async (c) => {
    const parsed = ListQuery.safeParse({
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
      contractId: c.req.query("contractId"),
      aggregatorName: c.req.query("aggregatorName"),
    });
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const { limit, cursor: raw, contractId, aggregatorName } = parsed.data;
    const cursor = raw ? decodeCursor(raw) : null;
    if (raw && !cursor) {
      return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
    }

    const page = await listAggregatorPayouts(getDb(c), c.get("tenantId"), {
      limit,
      cursor,
      contractId,
      aggregatorName,
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

    const row = await getAggregatorPayoutById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }
    const row = await createAggregatorPayout(getDb(c), c.get("tenantId"), parsed.data);
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const body = await c.req.json().catch(() => null);
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const row = await updateAggregatorPayout(
      getDb(c),
      c.get("tenantId"),
      id,
      parsed.data,
    );
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteAggregatorPayout(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
