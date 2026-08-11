import { Hono } from "hono";
import { z } from "zod";
import {
  decodeCursor,
  listReconciliation,
  RECON_STATUSES,
} from "../../db/queries/commission-reconciliation";
import { getDb } from "../get-db";
import { jsonError } from "../lib/errors";
import type { HonoEnv } from "../types";

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  customerId: z.uuid().optional(),
  status: z.enum(RECON_STATUSES).optional(),
});

// Read-only per-contract reconciliation report. Statement writes go through
// /api/commission-statements.
export const commissionReconciliationRoutes = new Hono<HonoEnv>().get("/", async (c) => {
  const parsed = ListQuery.safeParse({
    limit: c.req.query("limit"),
    cursor: c.req.query("cursor"),
    customerId: c.req.query("customerId"),
    status: c.req.query("status"),
  });
  if (!parsed.success) {
    return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
  }

  const { limit, cursor: raw, customerId, status } = parsed.data;
  const cursor = raw ? decodeCursor(raw) : null;
  if (raw && !cursor) {
    return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
  }

  const page = await listReconciliation(getDb(c), c.get("tenantId"), {
    limit,
    cursor,
    customerId,
    status,
  });
  return c.json(page);
});
