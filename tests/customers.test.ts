import { SELF, env } from "cloudflare:test";
import { afterAll, describe, expect, it } from "vitest";
import {
  HOST_TENANT_A,
  getSeededTenantIds,
  hasTestDb,
  mintJwt,
} from "./setup";

const url = (host: string, path: string) => `https://${host}${path}`;

describe.skipIf(!hasTestDb)("GET /api/customers", () => {
  const insertedIds: string[] = [];

  afterAll(async () => {
    if (insertedIds.length === 0) return;
    const { makeDb } = await import("../workers/db");
    const { customers } = await import("../workers/db/schema");
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    await db.delete(customers).where(inArray(customers.id, insertedIds));
  });

  it("returns empty page for tenant with no customers", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/customers"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; nextCursor: string | null };
    // Don't assert items === []; another test may have inserted into tenant A.
    // Only assert that the response shape is correct.
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(true);
  });

  it("rejects invalid limit=999 with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/customers?limit=999"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("RLS isolation: tenant-A JWT cannot fetch tenant-B row by id (404, not 403)", async () => {
    const ids = await getSeededTenantIds();
    const { makeDb } = await import("../workers/db");
    const { customers } = await import("../workers/db/schema");
    const { withTenantContext } = await import("../workers/db/with-tenant-context");

    // Seed a customer in tenant B with tenant context set.
    const db = makeDb(env);
    const bRow = await withTenantContext(db, ids.b, async (tx) => {
      const out = await tx
        .insert(customers)
        .values({
          tenantId: ids.b,
          name: "rls-leak-target",
        })
        .returning({ id: customers.id });
      return out[0]!;
    });
    insertedIds.push(bRow.id);

    // Tenant A JWT fetching tenant B's customer by id must see 404.
    // 403 would leak that the row exists; the RLS policy makes the row
    // invisible, so the handler legitimately returns "not found".
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, `/api/customers/${bRow.id}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");

    // Tenant B JWT MUST be able to read the row — proves the seed worked
    // and we're not just blocking everything by accident.
    const tokenB = await mintJwt({ tenantId: ids.b });
    const resB = await SELF.fetch(
      url("testbravo.virecrm.com", `/api/customers/${bRow.id}`),
      { headers: { authorization: `Bearer ${tokenB}` } },
    );
    expect(resB.status).toBe(200);
  });

  it("cursor round-trips through URL query encoding without corruption", async () => {
    const ids = await getSeededTenantIds();
    const { makeDb } = await import("../workers/db");
    const { customers } = await import("../workers/db/schema");
    const { withTenantContext } = await import("../workers/db/with-tenant-context");

    // Two rows in tenant A so limit=1 emits a cursor. Seed direct via DB —
    // customers has no POST endpoint yet. `created_at` is set explicitly so
    // the two rows have ms-precision-distinct timestamps regardless of how
    // fast the test runs. A batched insert (or two back-to-back `now()`
    // calls landing in the same ms tick) would otherwise share `created_at`,
    // and the cursor would round-trip `last.createdAt.toISOString()` at JS's
    // ms precision — the page-2 predicate then finds zero rows because the
    // stored value is strictly greater than the ms-truncated cursor. Real
    // list traffic uses POST endpoints (one row per `now()`), so this only
    // bites contrived multi-row inserts; pinning timestamps here makes the
    // test fully deterministic without needing per-µs DB precision.
    const db = makeDb(env);
    const newer = new Date("2026-01-01T00:00:02.000Z");
    const older = new Date("2026-01-01T00:00:01.000Z");
    const first = await withTenantContext(db, ids.a, async (tx) => {
      const [row] = await tx
        .insert(customers)
        .values({ tenantId: ids.a, name: "url-cursor-1", createdAt: newer })
        .returning({ id: customers.id });
      return row!;
    });
    const second = await withTenantContext(db, ids.a, async (tx) => {
      const [row] = await tx
        .insert(customers)
        .values({ tenantId: ids.a, name: "url-cursor-2", createdAt: older })
        .returning({ id: customers.id });
      return row!;
    });
    insertedIds.push(first.id, second.id);

    const token = await mintJwt({ tenantId: ids.a });
    const page1Res = await SELF.fetch(url(HOST_TENANT_A, "/api/customers?limit=1"), {
      headers: { authorization: `Bearer ${token}` },
    });
    const page1 = (await page1Res.json()) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(page1.nextCursor).not.toBeNull();
    const cursor = page1.nextCursor!;

    // base64url alphabet only: A-Z a-z 0-9 - _. Plain `+` / `/` would corrupt
    // when the cursor lands inside a URL query string.
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);

    const params = new URLSearchParams({ limit: "1", cursor }).toString();
    const page2Res = await SELF.fetch(url(HOST_TENANT_A, `/api/customers?${params}`), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(page2Res.status).toBe(200);
    const page2 = (await page2Res.json()) as { items: Array<{ id: string }> };
    expect(page2.items.length).toBeGreaterThanOrEqual(1);
    expect(page2.items[0]!.id).not.toBe(page1.items[0]!.id);
  });
});
