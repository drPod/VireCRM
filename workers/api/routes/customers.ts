import { Hono } from "hono";
import { z } from "zod";
import { jsonError } from "../lib/errors";
import { getDb } from "../get-db";
import {
  createCustomer,
  decodeCursor,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} from "../../db/queries/customers";
import type { HonoEnv } from "../types";

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
});

// Body schemas omit server-controlled fields (`id`, `tenantId`, timestamps);
// `tenantId` is forced from the JWT context in the query layer. `null` is
// accepted on PATCH to clear nullable columns; on POST the DB default takes
// over when the key is absent.
const nullableStr = z.string().max(1024).nullable().optional();

const CreateCustomerBody = z
  .object({
    name: z.string().min(1).max(512),
    externalCustomerId: nullableStr,
    primaryContactName: nullableStr,
    primaryEmail: nullableStr,
    primaryPhone: nullableStr,
  })
  .strict();

const UpdateCustomerBody = z
  .object({
    name: z.string().min(1).max(512).optional(),
    externalCustomerId: nullableStr,
    primaryContactName: nullableStr,
    primaryEmail: nullableStr,
    primaryPhone: nullableStr,
  })
  .strict();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  })
  .post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateCustomerBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }
    const row = await createCustomer(getDb(c), c.get("tenantId"), parsed.data);
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const body = await c.req.json().catch(() => null);
    const parsed = UpdateCustomerBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }
    const row = await updateCustomer(getDb(c), c.get("tenantId"), id, parsed.data);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteCustomer(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
