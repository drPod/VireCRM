import { SELF, env } from "cloudflare:test";
import { afterAll, describe, expect, it } from "vitest";
import {
  HOST_TENANT_A,
  HOST_TENANT_B,
  getSeededTenantIds,
  hasTestDb,
  mintJwt,
} from "./setup";

const url = (host: string, path: string) => `https://${host}${path}`;

interface AgentRow {
  id: string;
  name: string;
  email: string | null;
  houseSplitPct: string | null;
  createdAt: string;
}

interface AgentListResponse {
  items: AgentRow[];
  nextCursor: string | null;
}

describe.skipIf(!hasTestDb)("agents CRUD", () => {
  const insertedIds: string[] = [];

  afterAll(async () => {
    if (insertedIds.length === 0) return;
    const { makeDb } = await import("../workers/db");
    const { agents } = await import("../workers/db/schema");
    const { inArray } = await import("drizzle-orm");
    const db = makeDb(env);
    await db.delete(agents).where(inArray(agents.id, insertedIds));
  });

  it("GET / returns empty page shape for a fresh tenant", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/agents"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AgentListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(
      true,
    );
  });

  it("POST / creates an agent and GET /:id returns it", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });

    const postRes = await SELF.fetch(url(HOST_TENANT_A, "/api/agents"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Alice Agent",
        email: `alice-${crypto.randomUUID()}@example.com`,
        houseSplitPct: "75.00",
      }),
    });
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as AgentRow;
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.name).toBe("Alice Agent");
    expect(created.email).toMatch(/^alice-/);
    expect(created.houseSplitPct).toBe("75.00");
    insertedIds.push(created.id);

    const getRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/agents/${created.id}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as AgentRow;
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("Alice Agent");
  });

  it("POST / rejects malformed email with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/agents"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Bob Agent",
        email: "not-an-email",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("POST / rejects missing name with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/agents"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "x@example.com" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });

  it("PATCH /:id updates fields and returns the row", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });

    const postRes = await SELF.fetch(url(HOST_TENANT_A, "/api/agents"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Carol Agent" }),
    });
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as AgentRow;
    insertedIds.push(created.id);

    const patchRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/agents/${created.id}`),
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Carol Renamed", houseSplitPct: "50.00" }),
      },
    );
    expect(patchRes.status).toBe(200);
    const updated = (await patchRes.json()) as AgentRow;
    expect(updated.name).toBe("Carol Renamed");
    expect(updated.houseSplitPct).toBe("50.00");
  });

  it("PATCH /:id returns 404 for nonexistent UUID", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const missing = "00000000-0000-4000-8000-0000000099aa";
    const res = await SELF.fetch(url(HOST_TENANT_A, `/api/agents/${missing}`), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "ghost" }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("DELETE /:id removes the row and returns 204", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });

    const postRes = await SELF.fetch(url(HOST_TENANT_A, "/api/agents"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Dave Agent" }),
    });
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as AgentRow;
    // Don't push to insertedIds — the DELETE step removes it.

    const delRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/agents/${created.id}`),
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      },
    );
    expect(delRes.status).toBe(204);

    const getRes = await SELF.fetch(
      url(HOST_TENANT_A, `/api/agents/${created.id}`),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(getRes.status).toBe(404);
  });

  it("DELETE /:id returns 404 for nonexistent UUID", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const missing = "00000000-0000-4000-8000-0000000099bb";
    const res = await SELF.fetch(url(HOST_TENANT_A, `/api/agents/${missing}`), {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("GET /:id 404 on malformed UUID (no driver leak)", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, "/api/agents/not-a-uuid"), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("NOT_FOUND");
  });

  it("RLS isolation: tenant A cannot fetch tenant B agent (404)", async () => {
    const ids = await getSeededTenantIds();
    const { makeDb } = await import("../workers/db");
    const { agents } = await import("../workers/db/schema");
    const { withTenantContext } = await import(
      "../workers/db/with-tenant-context"
    );

    const db = makeDb(env);
    const bRow = await withTenantContext(db, ids.b, async (tx) => {
      const out = await tx
        .insert(agents)
        .values({ tenantId: ids.b, name: "rls-leak-agent" })
        .returning({ id: agents.id });
      return out[0]!;
    });
    insertedIds.push(bRow.id);

    const tokenA = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, `/api/agents/${bRow.id}`), {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(404);

    const tokenB = await mintJwt({ tenantId: ids.b });
    const resB = await SELF.fetch(url(HOST_TENANT_B, `/api/agents/${bRow.id}`), {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(resB.status).toBe(200);
  });

  it("RLS isolation: tenant A PATCH on tenant B agent returns 404", async () => {
    const ids = await getSeededTenantIds();
    const { makeDb } = await import("../workers/db");
    const { agents } = await import("../workers/db/schema");
    const { withTenantContext } = await import(
      "../workers/db/with-tenant-context"
    );

    const db = makeDb(env);
    const bRow = await withTenantContext(db, ids.b, async (tx) => {
      const out = await tx
        .insert(agents)
        .values({ tenantId: ids.b, name: "rls-patch-target" })
        .returning({ id: agents.id });
      return out[0]!;
    });
    insertedIds.push(bRow.id);

    const tokenA = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, `/api/agents/${bRow.id}`), {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${tokenA}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "hijack" }),
    });
    expect(res.status).toBe(404);
  });

  it("RLS isolation: tenant A DELETE on tenant B agent returns 404", async () => {
    const ids = await getSeededTenantIds();
    const { makeDb } = await import("../workers/db");
    const { agents } = await import("../workers/db/schema");
    const { withTenantContext } = await import(
      "../workers/db/with-tenant-context"
    );

    const db = makeDb(env);
    const bRow = await withTenantContext(db, ids.b, async (tx) => {
      const out = await tx
        .insert(agents)
        .values({ tenantId: ids.b, name: "rls-delete-target" })
        .returning({ id: agents.id });
      return out[0]!;
    });
    insertedIds.push(bRow.id);

    const tokenA = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(url(HOST_TENANT_A, `/api/agents/${bRow.id}`), {
      method: "DELETE",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(404);
  });

  it("GET / cursor pagination round-trips", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });

    // Seed 3 agents in tenant A so we can paginate with limit=2.
    const seedNames = ["pag-1", "pag-2", "pag-3"];
    for (const name of seedNames) {
      const r = await SELF.fetch(url(HOST_TENANT_A, "/api/agents"), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      expect(r.status).toBe(201);
      const row = (await r.json()) as AgentRow;
      insertedIds.push(row.id);
    }

    const firstRes = await SELF.fetch(
      url(HOST_TENANT_A, "/api/agents?limit=2"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(firstRes.status).toBe(200);
    const firstPage = (await firstRes.json()) as AgentListResponse;
    expect(firstPage.items.length).toBe(2);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondRes = await SELF.fetch(
      url(
        HOST_TENANT_A,
        `/api/agents?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor!)}`,
      ),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(secondRes.status).toBe(200);
    const secondPage = (await secondRes.json()) as AgentListResponse;
    // Cursor consumed advances strictly past first-page tail; IDs don't repeat.
    const firstIds = new Set(firstPage.items.map((i) => i.id));
    for (const item of secondPage.items) {
      expect(firstIds.has(item.id)).toBe(false);
    }
  });

  it("GET / rejects malformed cursor with 400 VALIDATION", async () => {
    const ids = await getSeededTenantIds();
    const token = await mintJwt({ tenantId: ids.a });
    const res = await SELF.fetch(
      url(HOST_TENANT_A, "/api/agents?cursor=not-base64"),
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("VALIDATION");
  });
});
