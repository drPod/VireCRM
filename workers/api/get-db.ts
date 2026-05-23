import type { Context } from "hono";
import { makeDb } from "../db";
import type { HonoEnv } from "./types";

// Lazy per-request DB client. Cached on the context so multiple handler calls
// (e.g. middleware chains, sub-routes) share one postgres-js pool — but only
// allocated when something actually needs it.
export function getDb(c: Context<HonoEnv>) {
  const existing = c.get("db");
  if (existing) return existing;
  const db = makeDb(c.env);
  c.set("db", db);
  return db;
}
