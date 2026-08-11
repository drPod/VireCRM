import { Hono } from "hono";
import { z } from "zod";
import { decodeCursor, listRenewals } from "../../db/queries/renewals";
import { getDb } from "../get-db";
import { jsonError } from "../lib/errors";
import type { HonoEnv } from "../types";

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  cursor: z.string().min(1).max(512).optional(),
  days: z.coerce.number().int().min(1).max(365).default(90),
  customerId: z.uuid().optional(),
});

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Read-only renewal radar: active contracts ending within `days` of today.
export const renewalsRoutes = new Hono<HonoEnv>().get("/", async (c) => {
  const parsed = ListQuery.safeParse({
    limit: c.req.query("limit"),
    cursor: c.req.query("cursor"),
    days: c.req.query("days"),
    customerId: c.req.query("customerId"),
  });
  if (!parsed.success) {
    return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
  }

  const { limit, cursor: raw, days, customerId } = parsed.data;
  const cursor = raw ? decodeCursor(raw) : null;
  if (raw && !cursor) {
    return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
  }

  const now = Date.now();
  const windowStart = isoDate(now);
  const windowEnd = isoDate(now + days * 86_400_000);

  const page = await listRenewals(getDb(c), c.get("tenantId"), {
    limit,
    cursor,
    windowStart,
    windowEnd,
    customerId,
  });
  return c.json({ ...page, windowStart, windowEnd });
});
