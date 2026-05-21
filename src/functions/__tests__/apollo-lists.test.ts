/**
 * Unit tests for src/functions/apollo-lists.functions.ts
 *
 * These tests exercise the actual production handlers behind the two
 * Apollo-list server functions. We work around TanStack Start's middleware
 * chain by mocking `createServerFn` so the handler we register is captured
 * verbatim — the test can then invoke it directly with a synthesized
 * `{ data, context }` payload, mirroring what `requireSupabaseAuth` would
 * have produced upstream.
 *
 * What we cover (per task spec):
 *  - List fetch — Apollo connector returns metadata, server fn maps it.
 *  - Quota check — RPC returns ok=false → throws QUOTA_EXCEEDED + ai_call_log row.
 *  - Quota consumption — RPC called with `p_count = slice.length`.
 *  - Email reveal flow — `revealApolloEmail` called once per slice member, results tracked.
 *  - Sync log emission — `recordLeadSync` invoked on success, partial, and error.
 *  - Auth context — `assertOrgMember` reads userId from the synthesized context.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------- module-level mocks ----------
// `createServerFn` returns a builder where each chained call returns the
// builder, except `.handler(fn)` which returns `fn` itself. That lets the test
// import `importApolloListFn` (etc.) and invoke it as a plain async function.
vi.mock("@tanstack/react-start", () => {
  const builder = {
    middleware: () => builder,
    inputValidator: () => builder,
    handler: (fn: unknown) => fn,
  };
  return { createServerFn: () => builder };
});

// Auth + subscription middlewares: identity passthrough — we synthesize the
// context manually when invoking the handler.
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: { __middleware: "auth" },
}));
vi.mock("@/integrations/supabase/subscription-middleware", () => ({
  requireActiveSubscription: { __middleware: "subscription" },
}));

// Org-member assertion: configurable per-test via the spy below.
const assertOrgMemberMock = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {});
vi.mock("@/lib/auth-helpers", () => ({
  assertOrgMember: (...args: unknown[]) => assertOrgMemberMock(...args),
}));

// Apollo connector: every fn is a vi.fn() so tests can program responses.
const listApolloListsMock = vi.fn();
const getApolloListMembersMock = vi.fn();
const revealApolloEmailMock = vi.fn();
vi.mock("@/lib/connectors/apollo", () => ({
  listApolloLists: (...a: unknown[]) => listApolloListsMock(...a),
  getApolloListMembers: (...a: unknown[]) => getApolloListMembersMock(...a),
  revealApolloEmail: (...a: unknown[]) => revealApolloEmailMock(...a),
}));

// Lead-sync log: spy only. Real impl just inserts into a table.
const recordLeadSyncMock = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {});
vi.mock("../_lead-sync-log", () => ({
  recordLeadSync: (...a: unknown[]) => recordLeadSyncMock(...a),
}));

// ---------- Supabase admin fake ----------
// The production handler touches several tables on `supabaseAdmin`:
//   - org_integrations (select api_key)
//   - organizations    (select/update leads_used_this_period — refund path)
//   - leads            (select existing emails, insert new ones)
//   - ai_call_log      (insert quota-exceeded row)
//   - rpc("consume_platform_lead_quota")
// We expose handlers per table that tests can override; the chain returned by
// `.from(...)` records every method call so we can also assert query shape.

type QueryHandler = (ops: Array<{ method: string; args: unknown[] }>) => {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

const tableHandlers = new Map<string, QueryHandler>();
const insertedRows = new Map<string, unknown[][]>();
const updatedRows: Array<{ table: string; values: unknown; ops: string[] }> = [];
let rpcMock: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

function setTableHandler(table: string, fn: QueryHandler) {
  tableHandlers.set(table, fn);
}

function makeChain(table: string) {
  const ops: Array<{ method: string; args: unknown[] }> = [];
  let isInsertOrUpdate = false;
  let pendingValues: unknown = undefined;

  const chain: any = {
    select(..._args: unknown[]) {
      ops.push({ method: "select", args: _args });
      return chain;
    },
    eq(...args: unknown[]) {
      ops.push({ method: "eq", args });
      return chain;
    },
    in(...args: unknown[]) {
      ops.push({ method: "in", args });
      return chain;
    },
    maybeSingle() {
      ops.push({ method: "maybeSingle", args: [] });
      return chain;
    },
    insert(values: unknown, options?: unknown) {
      ops.push({ method: "insert", args: [values, options] });
      isInsertOrUpdate = true;
      pendingValues = values;
      const arr = insertedRows.get(table) ?? [];
      arr.push(Array.isArray(values) ? values : [values]);
      insertedRows.set(table, arr);
      // For insert-style we resolve immediately on then.
      return chain;
    },
    update(values: unknown) {
      ops.push({ method: "update", args: [values] });
      isInsertOrUpdate = true;
      pendingValues = values;
      updatedRows.push({ table, values, ops: ops.map((o) => o.method) });
      return chain;
    },
    then(resolve: (v: unknown) => void) {
      const handler = tableHandlers.get(table);
      const result = handler
        ? handler(ops)
        : { data: isInsertOrUpdate ? pendingValues : null, error: null, count: null };
      resolve(result);
    },
  };
  return chain;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => makeChain(table),
    rpc: (...a: unknown[]) => rpcMock(...a),
  },
}));

// ---------- shared fixtures ----------
const ORG_ID = "00000000-0000-0000-0000-000000000abc";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const LIST_ID = "list_abc";
const LIST_NAME = "Q3 Prospects";
const API_KEY = "apl_test_key";

function fakeContext() {
  return {
    supabase: { __tag: "user-scoped-client" } as any,
    userId: USER_ID,
    claims: { sub: USER_ID } as any,
  };
}

function programOrgApolloKey(key: string | null = API_KEY) {
  setTableHandler("org_integrations", () => ({
    data: key ? { api_key: key } : null,
    error: null,
  }));
}

function programOrgUsage(used: number) {
  setTableHandler("organizations", () => ({
    data: { leads_used_this_period: used },
    error: null,
  }));
}

function programExistingLeads(emails: string[]) {
  setTableHandler("leads", (ops) => {
    const insertOp = ops.find((o) => o.method === "insert");
    if (insertOp) {
      const rows = insertOp.args[0];
      const count = Array.isArray(rows) ? rows.length : 1;
      return { data: rows, error: null, count };
    }
    return {
      data: emails.map((e) => ({ email: e })),
      error: null,
    };
  });
}

function makePerson(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    first_name: "Ada",
    last_name: "Lovelace",
    title: "CTO",
    organization: { name: "Analytical Engines Ltd", estimated_num_employees: 42 },
    linkedin_url: "https://linkedin.com/in/ada",
    ...overrides,
  };
}

// ---------- per-test reset ----------
beforeEach(() => {
  assertOrgMemberMock.mockReset();
  assertOrgMemberMock.mockImplementation(async () => {});
  listApolloListsMock.mockReset();
  getApolloListMembersMock.mockReset();
  revealApolloEmailMock.mockReset();
  recordLeadSyncMock.mockReset();
  recordLeadSyncMock.mockImplementation(async () => {});
  tableHandlers.clear();
  insertedRows.clear();
  updatedRows.length = 0;
  rpcMock = vi.fn();
});

// ============================================================================
// listApolloListsFn
// ============================================================================
describe("listApolloListsFn", () => {
  it("returns list metadata mapped from the Apollo connector", async () => {
    const { listApolloListsFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    listApolloListsMock.mockResolvedValue([
      { id: "lst_1", name: "Hot leads", cached_count: 17 },
      { id: "lst_2", name: "Cold leads", cached_count: undefined },
    ]);

    const result = await (listApolloListsFn as any)({
      data: { organizationId: ORG_ID },
      context: fakeContext(),
    });

    expect(listApolloListsMock).toHaveBeenCalledWith(API_KEY);
    expect(result).toEqual({
      lists: [
        { id: "lst_1", name: "Hot leads", count: 17 },
        { id: "lst_2", name: "Cold leads", count: null },
      ],
    });
  });

  it("calls assertOrgMember with the synthesized context userId", async () => {
    const { listApolloListsFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    listApolloListsMock.mockResolvedValue([]);

    await (listApolloListsFn as any)({
      data: { organizationId: ORG_ID },
      context: fakeContext(),
    });

    expect(assertOrgMemberMock).toHaveBeenCalledTimes(1);
    const [, userId, orgId] = assertOrgMemberMock.mock.calls[0];
    expect(userId).toBe(USER_ID);
    expect(orgId).toBe(ORG_ID);
  });

  it("throws INTEGRATION_MISSING when no Apollo key is saved", async () => {
    const { listApolloListsFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(null);

    await expect(
      (listApolloListsFn as any)({
        data: { organizationId: ORG_ID },
        context: fakeContext(),
      }),
    ).rejects.toThrow(/INTEGRATION_MISSING/);
  });

  it("translates Apollo auth errors into AUTH coded error", async () => {
    const { listApolloListsFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    const apErr = Object.assign(new Error("401"), { isAuthError: true });
    listApolloListsMock.mockRejectedValue(apErr);

    await expect(
      (listApolloListsFn as any)({
        data: { organizationId: ORG_ID },
        context: fakeContext(),
      }),
    ).rejects.toThrow(/\[AUTH\]/);
  });
});

// ============================================================================
// importApolloListFn
// ============================================================================
describe("importApolloListFn", () => {
  it("happy path: fetches, reveals, dedupes, inserts, and logs success", async () => {
    const { importApolloListFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    programExistingLeads([]); // no duplicates

    getApolloListMembersMock.mockResolvedValue({
      people: [makePerson("p1"), makePerson("p2", { first_name: "Bob" })],
      totalEntries: 2,
      totalPages: 1,
    });
    revealApolloEmailMock
      .mockResolvedValueOnce({ email: "ada@example.com", phone: "+15551111" })
      .mockResolvedValueOnce({ email: "bob@example.com", phone: null });

    rpcMock.mockResolvedValue({
      data: { ok: true, used: 12, quota: 100, remaining: 88 },
      error: null,
    });

    const result = await (importApolloListFn as any)({
      data: { organizationId: ORG_ID, listId: LIST_ID, listName: LIST_NAME, maxLeads: 50 },
      context: fakeContext(),
    });

    expect(result).toEqual({
      fetched: 2,
      revealed: 2,
      inserted: 2,
      duplicates: 0,
      noEmail: 0,
    });

    // Quota was reserved for the slice size.
    expect(rpcMock).toHaveBeenCalledWith("consume_platform_lead_quota", {
      p_org_id: ORG_ID,
      p_count: 2,
    });
    // Both leads were revealed.
    expect(revealApolloEmailMock).toHaveBeenCalledTimes(2);
    // Insert into `leads` happened.
    const leadInserts = insertedRows.get("leads") ?? [];
    expect(leadInserts.length).toBe(1);
    expect(leadInserts[0].length).toBe(2);
    // Sync log fired with success status.
    expect(recordLeadSyncMock).toHaveBeenCalledTimes(1);
    expect(recordLeadSyncMock.mock.calls[0][0]).toMatchObject({
      organizationId: ORG_ID,
      userId: USER_ID,
      provider: "apollo",
      source: "apollo_list_import",
      status: "success",
      fetched: 2,
      revealed: 2,
      inserted: 2,
    });
  });

  it("quota exceeded: rejects, writes ai_call_log row, logs quota_exceeded sync", async () => {
    const { importApolloListFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);

    getApolloListMembersMock.mockResolvedValue({
      people: [makePerson("p1"), makePerson("p2"), makePerson("p3")],
      totalEntries: 3,
      totalPages: 1,
    });

    rpcMock.mockResolvedValue({
      data: { ok: false, error: "quota_exceeded", used: 100, quota: 100, remaining: 0 },
      error: null,
    });

    await expect(
      (importApolloListFn as any)({
        data: { organizationId: ORG_ID, listId: LIST_ID, listName: LIST_NAME, maxLeads: 10 },
        context: fakeContext(),
      }),
    ).rejects.toThrow(/QUOTA_EXCEEDED/);

    // ai_call_log row was written before the throw.
    const aiRows = insertedRows.get("ai_call_log") ?? [];
    expect(aiRows.length).toBe(1);
    expect(aiRows[0][0]).toMatchObject({
      organization_id: ORG_ID,
      user_id: USER_ID,
      feature: "apollo_list_import",
      status: "quota_exceeded",
    });

    // Reveal never happened (we bail before).
    expect(revealApolloEmailMock).not.toHaveBeenCalled();

    // Sync log captured the failure with quota_exceeded status.
    expect(recordLeadSyncMock).toHaveBeenCalledTimes(1);
    expect(recordLeadSyncMock.mock.calls[0][0]).toMatchObject({
      status: "quota_exceeded",
      errorCode: "QUOTA_EXCEEDED",
    });
  });

  it("quota consumption: deducts exactly the slice size (capped at maxLeads)", async () => {
    const { importApolloListFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    programExistingLeads([]);

    // Connector returns 5 people but caller only asked for 3.
    getApolloListMembersMock.mockResolvedValue({
      people: [
        makePerson("p1"),
        makePerson("p2"),
        makePerson("p3"),
        makePerson("p4"),
        makePerson("p5"),
      ],
      totalEntries: 5,
      totalPages: 1,
    });
    revealApolloEmailMock.mockResolvedValue({ email: "x@example.com", phone: null });

    rpcMock.mockResolvedValue({
      data: { ok: true, used: 3, quota: 100, remaining: 97 },
      error: null,
    });

    await (importApolloListFn as any)({
      data: { organizationId: ORG_ID, listId: LIST_ID, listName: LIST_NAME, maxLeads: 3 },
      context: fakeContext(),
    });

    expect(rpcMock).toHaveBeenCalledWith("consume_platform_lead_quota", {
      p_org_id: ORG_ID,
      p_count: 3, // slice cap, NOT 5 fetched
    });
    // Reveal was called 3 times — one per slice member, not 5.
    expect(revealApolloEmailMock).toHaveBeenCalledTimes(3);
  });

  it("email reveal flow: secondary reveal call per person, results tracked", async () => {
    const { importApolloListFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    programExistingLeads([]);

    // Two people: one reveals successfully, one returns null email.
    getApolloListMembersMock.mockResolvedValue({
      people: [makePerson("p1"), makePerson("p2")],
      totalEntries: 2,
      totalPages: 1,
    });
    revealApolloEmailMock
      .mockResolvedValueOnce({ email: "ada@example.com", phone: null })
      .mockResolvedValueOnce({ email: null, phone: null });

    rpcMock.mockResolvedValue({
      data: { ok: true, used: 2, quota: 100, remaining: 98 },
      error: null,
    });

    const result = await (importApolloListFn as any)({
      data: { organizationId: ORG_ID, listId: LIST_ID, listName: LIST_NAME, maxLeads: 2 },
      context: fakeContext(),
    });

    expect(revealApolloEmailMock).toHaveBeenCalledTimes(2);
    // First call sees person p1.
    expect(revealApolloEmailMock.mock.calls[0][0]).toBe(API_KEY);
    expect((revealApolloEmailMock.mock.calls[0][1] as any).id).toBe("p1");
    // Only the one with an email got inserted.
    expect(result.revealed).toBe(1);
    expect(result.inserted).toBe(1);
    expect(result.noEmail).toBe(1);
  });

  it("Apollo credits exhausted on first reveal → CREDITS coded error + sync log error", async () => {
    const { importApolloListFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    programExistingLeads([]);

    getApolloListMembersMock.mockResolvedValue({
      people: [makePerson("p1"), makePerson("p2")],
      totalEntries: 2,
      totalPages: 1,
    });
    const creditErr = Object.assign(new Error("no credits"), { isCreditError: true });
    revealApolloEmailMock.mockRejectedValueOnce(creditErr);

    rpcMock.mockResolvedValue({
      data: { ok: true, used: 2, quota: 100, remaining: 98 },
      error: null,
    });

    await expect(
      (importApolloListFn as any)({
        data: { organizationId: ORG_ID, listId: LIST_ID, listName: LIST_NAME, maxLeads: 2 },
        context: fakeContext(),
      }),
    ).rejects.toThrow(/\[CREDITS\]/);

    expect(recordLeadSyncMock).toHaveBeenCalledTimes(1);
    expect(recordLeadSyncMock.mock.calls[0][0]).toMatchObject({
      status: "error",
      errorCode: "CREDITS",
    });
  });

  it("empty list short-circuits and logs success with reason empty_list", async () => {
    const { importApolloListFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    getApolloListMembersMock.mockResolvedValue({
      people: [],
      totalEntries: 0,
      totalPages: 1,
    });

    const result = await (importApolloListFn as any)({
      data: { organizationId: ORG_ID, listId: LIST_ID, listName: LIST_NAME, maxLeads: 25 },
      context: fakeContext(),
    });

    expect(result).toEqual({
      fetched: 0,
      revealed: 0,
      inserted: 0,
      duplicates: 0,
      noEmail: 0,
    });
    // RPC never called — we never reached the quota step.
    expect(rpcMock).not.toHaveBeenCalled();
    expect(recordLeadSyncMock).toHaveBeenCalledTimes(1);
    expect(recordLeadSyncMock.mock.calls[0][0]).toMatchObject({
      status: "success",
      metadata: expect.objectContaining({ reason: "empty_list" }),
    });
  });

  it("auth-mid-import: refunds remaining quota and rethrows AUTH", async () => {
    const { importApolloListFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    programOrgUsage(50);

    getApolloListMembersMock.mockResolvedValue({
      people: [makePerson("p1"), makePerson("p2"), makePerson("p3")],
      totalEntries: 3,
      totalPages: 1,
    });
    revealApolloEmailMock
      .mockResolvedValueOnce({ email: "ada@example.com", phone: null })
      .mockRejectedValueOnce(Object.assign(new Error("revoked"), { isAuthError: true }));

    rpcMock.mockResolvedValue({
      data: { ok: true, used: 3, quota: 100, remaining: 97 },
      error: null,
    });

    await expect(
      (importApolloListFn as any)({
        data: { organizationId: ORG_ID, listId: LIST_ID, listName: LIST_NAME, maxLeads: 3 },
        context: fakeContext(),
      }),
    ).rejects.toThrow(/\[AUTH\]/);

    // Refund path: at least one update to `organizations` with decreased
    // leads_used_this_period (50 - 2 = 48 since one reveal succeeded, two
    // pending refunded).
    const orgUpdates = updatedRows.filter((u) => u.table === "organizations");
    expect(orgUpdates.length).toBeGreaterThan(0);
    expect((orgUpdates[0].values as any).leads_used_this_period).toBe(48);
  });

  it("logs partial when reveals yield zero emails (no credit exhaustion)", async () => {
    const { importApolloListFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    programOrgUsage(10);

    getApolloListMembersMock.mockResolvedValue({
      people: [makePerson("p1")],
      totalEntries: 1,
      totalPages: 1,
    });
    revealApolloEmailMock.mockResolvedValue({ email: null, phone: null });

    rpcMock.mockResolvedValue({
      data: { ok: true, used: 1, quota: 100, remaining: 99 },
      error: null,
    });

    const result = await (importApolloListFn as any)({
      data: { organizationId: ORG_ID, listId: LIST_ID, listName: LIST_NAME, maxLeads: 1 },
      context: fakeContext(),
    });

    expect(result).toEqual({
      fetched: 1,
      revealed: 0,
      inserted: 0,
      duplicates: 0,
      noEmail: 1,
    });
    expect(recordLeadSyncMock).toHaveBeenCalledTimes(1);
    expect(recordLeadSyncMock.mock.calls[0][0]).toMatchObject({
      status: "partial",
      noEmail: 1,
    });
  });

  it("dedupes inserts against existing org emails (case-insensitive)", async () => {
    const { importApolloListFn } = await import("../apollo-lists.functions");
    programOrgApolloKey(API_KEY);
    // Existing lead with same email — should be filtered out.
    programExistingLeads(["ada@example.com"]);

    getApolloListMembersMock.mockResolvedValue({
      people: [makePerson("p1"), makePerson("p2")],
      totalEntries: 2,
      totalPages: 1,
    });
    revealApolloEmailMock
      .mockResolvedValueOnce({ email: "ADA@Example.com", phone: null })
      .mockResolvedValueOnce({ email: "bob@example.com", phone: null });

    rpcMock.mockResolvedValue({
      data: { ok: true, used: 2, quota: 100, remaining: 98 },
      error: null,
    });

    const result = await (importApolloListFn as any)({
      data: { organizationId: ORG_ID, listId: LIST_ID, listName: LIST_NAME, maxLeads: 2 },
      context: fakeContext(),
    });

    expect(result.duplicates).toBe(1);
    expect(result.inserted).toBe(1);
    const leadInserts = insertedRows.get("leads") ?? [];
    expect(leadInserts[0].length).toBe(1); // only bob got inserted
    expect((leadInserts[0][0] as any).email).toBe("bob@example.com");
  });
});
