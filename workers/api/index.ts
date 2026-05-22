import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { makeDb } from "../db";

export const api = new Hono<{ Bindings: Env }>();

api.get("/health", (c) => c.json({ ok: true }));

api.get("/db-ping", async (c) => {
  try {
    const db = makeDb(c.env);
    const result = await db.execute(sql`SELECT 1 AS one`);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});
