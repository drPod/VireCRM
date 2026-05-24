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

// `houseSplitPct` is `numeric` in Postgres — postgres-js returns it as a string
// and accepts it as a string on write. Accept either form on the wire and
// normalize to string before handing it to the driver. Range matches the
// `numeric(5, 2)` column shape.
const HouseSplitPct = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v))
  .refine((v) => /^-?\d+(\.\d+)?$/.test(v), { message: "must be numeric" })
  .refine(
    (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 100;
    },
    { message: "must be between 0 and 100" },
  );

const CreateBody = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255).optional(),
  houseSplitPct: HouseSplitPct.optional(),
});

const UpdateBody = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
    houseSplitPct: HouseSplitPct.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field required",
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    // Validate the path param before hitting Postgres — an `id` that doesn't
    // match the UUID shape would throw at the driver. We answer 404 (not 400)
    // because malformed IDs and missing rows are indistinguishable to the
    // caller, and 400 would leak that the format was wrong.
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getAgentById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return jsonError(c, 400, "VALIDATION", { body: "invalid JSON" });
    }
    const parsed = CreateBody.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }
    const row = await createAgent(getDb(c), c.get("tenantId"), parsed.data);
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return jsonError(c, 400, "VALIDATION", { body: "invalid JSON" });
    }
    const parsed = UpdateBody.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }

    const row = await updateAgent(getDb(c), c.get("tenantId"), id, parsed.data);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteAgent(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
