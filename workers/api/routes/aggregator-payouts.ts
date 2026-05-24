import { Hono } from "hono";
import { z } from "zod";
import { jsonError } from "../lib/errors";
import { getDb } from "../get-db";
import {
  ContractNotInTenantError,
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

// Postgres `numeric` is a string in postgres-js (avoids float rounding). Bound
// by column precision so overflow surfaces as 400 VALIDATION, not Postgres
// `numeric field overflow` → 500.
function numericStr(precision: number, scale: number) {
  const intDigits = precision - scale;
  const re = new RegExp(
    `^-?(0|[1-9]\\d{0,${intDigits - 1}})(\\.\\d{1,${scale}})?$`,
  );
  return z
    .string()
    .regex(re, `must be numeric with ≤${intDigits} integer / ≤${scale} fractional digits`);
}

// Precisions mirror workers/db/schema/aggregator-payouts.ts.
const aggregatorCommPctStr = numericStr(5, 2);
const amountStr = numericStr(20, 2);

// `z.iso.date()` validates a real calendar date (rejects 2026-13-99); regex
// shape-check would let invalid dates through and surface as Postgres 500s.
const dateStr = z.iso.date();

const ListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).max(512).optional(),
    contractId: uuid.optional(),
    aggregatorName: z.string().min(1).max(255).optional(),
  })
  .strict();

const CreateBody = z
  .object({
    contractId: uuid,
    aggregatorName: z.string().min(1).max(255),
    aggregatorCommPct: aggregatorCommPctStr.nullish(),
    periodStart: dateStr.nullish(),
    periodEnd: dateStr.nullish(),
    amount: amountStr.nullish(),
  })
  .strict();

// Empty body would otherwise round-trip as a touch-`updated_at` no-op.
// `.strict()` runs before `.refine()` so unknown keys (typos like
// `aggreagtorName`) fail 400 instead of silent-dropping into a no-op patch.
const PatchBody = z
  .object({
    contractId: uuid.optional(),
    aggregatorName: z.string().min(1).max(255).optional(),
    aggregatorCommPct: aggregatorCommPctStr.nullish(),
    periodStart: dateStr.nullish(),
    periodEnd: dateStr.nullish(),
    amount: amountStr.nullish(),
  })
  .strict()
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
    // 404 (not 400) on malformed UUID: matches the "row exists but RLS-hidden"
    // response shape so callers can't probe format vs existence separately.
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
    try {
      const row = await createAggregatorPayout(getDb(c), c.get("tenantId"), parsed.data);
      return c.json(row, 201);
    } catch (err) {
      // 404 (not 403) on cross-tenant / missing contract — matches the
      // RLS-invisible response so callers can't probe tenant-B UUIDs.
      if (err instanceof ContractNotInTenantError) {
        return jsonError(c, 404, "NOT_FOUND");
      }
      throw err;
    }
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const body = await c.req.json().catch(() => null);
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    try {
      const row = await updateAggregatorPayout(
        getDb(c),
        c.get("tenantId"),
        id,
        parsed.data,
      );
      if (!row) return jsonError(c, 404, "NOT_FOUND");
      return c.json(row);
    } catch (err) {
      if (err instanceof ContractNotInTenantError) {
        return jsonError(c, 404, "NOT_FOUND");
      }
      throw err;
    }
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteAggregatorPayout(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
