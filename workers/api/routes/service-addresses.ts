import { Hono } from "hono";
import { z } from "zod";
import { jsonError } from "../lib/errors";
import { getDb } from "../get-db";
import {
  decodeCursor,
  getServiceAddressById,
  listServiceAddresses,
} from "../../db/queries/service-addresses";
import type { HonoEnv } from "../types";

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  customerId: z.uuid().optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const serviceAddressesRoutes = new Hono<HonoEnv>()
  .get("/", async (c) => {
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

    const page = await listServiceAddresses(getDb(c), c.get("tenantId"), {
      limit,
      cursor,
      filters: { customerId },
    });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Malformed UUIDs answer 404 (not 400) — same rationale as customers.ts.
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getServiceAddressById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  });
