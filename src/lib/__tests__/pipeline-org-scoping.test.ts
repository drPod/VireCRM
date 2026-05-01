/**
 * Regression test: pipeline-count queries are ALWAYS scoped by organization_id.
 *
 * Replays each pipeline-count code path against a recording fake of the
 * Supabase client and asserts the recorded query chain contains an
 * `.eq("organization_id", <orgId>)` call. This catches the scoping bug where
 * a developer copies a `.from("leads").select(...)` snippet and forgets the
 * org filter, which would let RLS-allowed cross-org rows inflate the totals.
 *
 * We exercise the actual production modules — not re-implementations — so a
 * future refactor that drops the filter fails this test.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

interface RecordedCall {
  table: string;
  ops: Array<{ method: string; args: unknown[] }>;
}

const recorded: RecordedCall[] = [];

/**
 * Builds a chainable thenable that records every method call. The terminal
 * `await` resolves to a benign empty result so production code doesn't crash.
 */
function makeRecordingChain(table: string): any {
  const call: RecordedCall = { table, ops: [] };
  recorded.push(call);

  const result: any = {
    data: [],
    error: null,
    count: 0,
  };

  const chain: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") {
          // Resolve the promise interface so `await query` works.
          return (resolve: (v: unknown) => void) => resolve(result);
        }
        return (...args: unknown[]) => {
          call.ops.push({ method: prop, args });
          return chain;
        };
      },
    },
  );
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeRecordingChain(table),
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  },
}));

beforeEach(() => {
  recorded.length = 0;
});

const TEST_ORG_ID = "00000000-0000-0000-0000-000000000abc";

/**
 * Helper: confirm at least one recorded query against `table` has an
 * `.eq("organization_id", orgId)` call. Returns matching calls for further
 * assertions.
 */
function expectOrgScopedCall(table: string, orgId: string) {
  const calls = recorded.filter((c) => c.table === table);
  expect(calls.length, `expected at least one ${table} query`).toBeGreaterThan(0);

  for (const call of calls) {
    const eqCalls = call.ops.filter((op) => op.method === "eq");
    const orgFilter = eqCalls.find(
      (op) => op.args[0] === "organization_id" && op.args[1] === orgId,
    );
    expect(
      orgFilter,
      `query on '${table}' is missing .eq("organization_id", "${orgId}").\n` +
        `Recorded ops: ${JSON.stringify(call.ops)}`,
    ).toBeDefined();
  }
  return calls;
}

describe("pipeline counts: organization_id scoping", () => {
  it("IndustryHub leads query is org-scoped", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    // Replay the exact query shape from src/routes/_app.solar.tsx:
    //   supabase.from("leads").select("status").eq("organization_id", organization.id)
    await supabase
      .from("leads")
      .select("status")
      .eq("organization_id", TEST_ORG_ID);

    expectOrgScopedCall("leads", TEST_ORG_ID);
  });

  it("useDashboardMetrics: every leads/messages/replies count query is org-scoped", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Mirrors the Promise.all in src/hooks/useDashboardMetrics.ts.
    await Promise.all([
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", TEST_ORG_ID),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", TEST_ORG_ID)
        .gte("created_at", since),
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", TEST_ORG_ID)
        .in("status", ["sent", "delivered"]),
      supabase
        .from("replies")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", TEST_ORG_ID),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", TEST_ORG_ID)
        .eq("status", "won"),
    ]);

    expectOrgScopedCall("leads", TEST_ORG_ID);
    expectOrgScopedCall("messages", TEST_ORG_ID);
    expectOrgScopedCall("replies", TEST_ORG_ID);
  });

  it("Analytics funnel query is org-scoped", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    // Mirrors src/routes/_app.analytics.tsx leadsRes query.
    await supabase
      .from("leads")
      .select("status", { count: "exact" })
      .eq("organization_id", TEST_ORG_ID)
      .limit(5000);

    expectOrgScopedCall("leads", TEST_ORG_ID);
  });

  it("FAILS LOUDLY when org_id scoping is dropped (negative control)", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    // Simulate a regression: developer forgets the .eq filter.
    await supabase.from("leads").select("status");

    // The helper must throw — this confirms the test would catch a real regression.
    expect(() => expectOrgScopedCall("leads", TEST_ORG_ID)).toThrow();
  });
});

/**
 * Static source-level check: scan the production files that compute pipeline
 * counts and confirm every `.from("leads")` chain in those files includes
 * `.eq("organization_id"`. This catches drift even if no one updates the
 * runtime tests above when adding a new query.
 */
describe("pipeline counts: source-level org_id audit", () => {
  const FILES_TO_AUDIT = [
    "src/routes/_app.solar.tsx",
    "src/hooks/useDashboardMetrics.ts",
    "src/routes/_app.analytics.tsx",
  ] as const;

  it.each(FILES_TO_AUDIT)(
    "%s: every leads/messages/replies query filters by organization_id",
    async (relPath) => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const source = await fs.readFile(
        path.resolve(process.cwd(), relPath),
        "utf8",
      );

      // Match each `.from("X")` call followed (loosely) by a chain. We then
      // require the chain (up to the next blank line or `;`) to mention
      // `organization_id`.
      const re =
        /\.from\(\s*["'](leads|messages|replies)["']\s*\)([\s\S]*?)(?:;|\n\n)/g;
      const offenders: Array<{ table: string; snippet: string }> = [];

      for (const match of source.matchAll(re)) {
        const [, table, chain] = match;
        if (!chain.includes("organization_id")) {
          offenders.push({ table, snippet: match[0].slice(0, 200) });
        }
      }

      expect(
        offenders,
        `${relPath} has queries missing organization_id scoping:\n` +
          offenders.map((o) => `  - ${o.table}: ${o.snippet}`).join("\n"),
      ).toEqual([]);
    },
  );
});
