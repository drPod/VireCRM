import type { Context } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../types";

// Canonical hex UUID shape. Routes use this BEFORE hitting Postgres so a
// malformed `:id` becomes a 404 (indistinguishable from missing row) rather
// than a driver-level cast error surfaced as 500.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuid = z.string().regex(UUID_RE);

// Read JSON body; return null on parse failure. Callers map null → 400
// VALIDATION inline. Keeps the helper signature dead simple and lets each
// route customize the `details` payload.
export async function readJson(c: Context<HonoEnv>): Promise<unknown | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
