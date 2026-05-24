import { Hono } from "hono";
import { z } from "zod";
import {
  createServiceAddress,
  decodeCursor,
  deleteServiceAddress,
  getServiceAddressById,
  listServiceAddresses,
  updateServiceAddress,
} from "../../db/queries/service-addresses";
import { getDb } from "../get-db";
import { jsonError } from "../lib/errors";
import type { HonoEnv } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Uuid = z.string().regex(UUID_RE, "must be a UUID");

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  customerId: Uuid.optional(),
});

// `""` and `undefined` both collapse to `null` so a client clearing a field
// can send either form without writing the empty string into the column.
const optText = z
  .string()
  .max(500)
  .nullish()
  .transform((v) => (v === "" || v == null ? null : v));

const CreateBody = z.object({
  customerId: Uuid,
  streetNo: optText,
  streetName: optText,
  addressLine1: optText,
  addressLine2: optText,
  city: optText,
  state: optText,
  zip: optText,
  county: optText,
  govtArea: optText,
});

// PATCH = partial. Strip `customerId` from updatable fields — reassigning a
// service address to a different customer is a domain-level operation, not a
// generic field edit (cascade rules, ESI/contract relationships re-link).
const UpdateBody = z
  .object({
    streetNo: optText,
    streetName: optText,
    addressLine1: optText,
    addressLine2: optText,
    city: optText,
    state: optText,
    zip: optText,
    county: optText,
    govtArea: optText,
  })
  .partial();

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
      customerId,
    });
    return c.json(page);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    // Malformed UUID → 404, not 400, so the existence of the row isn't
    // leaked by error-code distinction (mirrors customers.ts).
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const row = await getServiceAddressById(getDb(c), c.get("tenantId"), id);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }
    const row = await createServiceAddress(getDb(c), c.get("tenantId"), parsed.data);
    // Null return = customer not visible in this tenant (RLS-gated lookup
    // inside createServiceAddress). Surface as 404 so a cross-tenant
    // customerId isn't distinguishable from a deleted/missing one.
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const body = await c.req.json().catch(() => null);
    const parsed = UpdateBody.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, "VALIDATION", parsed.error.flatten());
    }
    if (Object.keys(parsed.data).length === 0) {
      return jsonError(c, 400, "VALIDATION", {
        body: "must contain at least one field",
      });
    }
    const row = await updateServiceAddress(getDb(c), c.get("tenantId"), id, parsed.data);
    if (!row) return jsonError(c, 404, "NOT_FOUND");
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return jsonError(c, 404, "NOT_FOUND");

    const ok = await deleteServiceAddress(getDb(c), c.get("tenantId"), id);
    if (!ok) return jsonError(c, 404, "NOT_FOUND");
    return c.body(null, 204);
  });
