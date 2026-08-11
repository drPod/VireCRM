import { Hono } from "hono";
import { z } from "zod";
import { jsonError } from "../lib/errors";
import { getDb } from "../get-db";
import { decodeCursor, listCurrentClients } from "../../db/queries/current-clients";
import type { HonoEnv } from "../types";

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  customerId: z.uuid().optional(),
});

// Read-only denormalized view (active contracts ⋈ esi ⋈ address ⋈ customer)
// backing the Current Clients tab. Mutations go through /api/contracts.
export const currentClientsRoutes = new Hono<HonoEnv>().get("/", async (c) => {
  const parsed = ListQuery.safeParse({
    limit: c.req.query("limit"),
    cursor: c.req.query("cursor"),
    customerId: c.req.query("customerId"),
  });
  if (!parsed.success) {
    return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
  }

  const { limit, cursor: raw, customerId } = parsed.data;
  const cursor = raw ? decodeCursor(raw) : null;
  if (raw && !cursor) {
    return jsonError(c, 400, "VALIDATION", { cursor: "malformed" });
  }

  const page = await listCurrentClients(getDb(c), c.get("tenantId"), {
    limit,
    cursor,
    filters: { customerId },
  });
  return c.json(page);
});
