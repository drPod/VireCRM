import { Hono } from "hono";
import { z } from "zod";
import { decodeCursor } from "../../db/queries/_pagination";
import { getCustomerById, listCustomers } from "../../db/queries/customers";
import { getDb } from "../get-db";
import { jsonError } from "../lib/errors";
import { UUID_RE } from "../lib/request";
import type { HonoEnv } from "../types";

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
});

export const customersRoutes = new Hono<HonoEnv>()
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

    const page = await listCustomers(getDb(c), c.get("tenantId"), { limit, cursor });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Validate the path param before hitting Postgres — an `id` that doesn't
    // match the UUID shape would throw at the driver. We answer 404 (not 400)
    // because malformed IDs and missing rows are indistinguishable to the
    // caller, and 400 would leak that the format was wrong.
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getCustomerById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  });
