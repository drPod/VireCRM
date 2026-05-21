/**
 * Unit tests for the find-leads server function.
 *
 * Exercises the inner handler (`_findLeadsHandler`) directly so we can skip
 * the TanStack Start middleware chain (auth + subscription) and focus on:
 *   - provider routing (apollo / hunter / snov)
 *   - platform quota consumption + refund
 *   - lead_sync_log row shape
 *   - provider error mapping (auth, credit/rate-limit)
 *   - empty result -> "partial" log + ok return
 *
 * Connector modules, the Supabase admin client, and the lead-sync log helper
 * are all mocked. The handler-scoped Supabase client (from auth middleware)
 * is supplied per-call as a builder stub.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// --- Mock the connector modules ---------------------------------------------

vi.mock("@/lib/connectors/apollo", () => ({
  searchApolloPeople: vi.fn(),
  revealApolloEmail: vi.fn(),
}));

vi.mock("@/lib/connectors/hunter", () => ({
  searchHunterDomain: vi.fn(),
}));

vi.mock("@/lib/connectors/snov", () => ({
  searchSnovDomain: vi.fn(),
}));

// --- Mock the lead-sync log helper ------------------------------------------

vi.mock("../_lead-sync-log", () => ({
  recordLeadSync: vi.fn(async () => {}),
}));

// --- Mock the server-only Supabase admin client -----------------------------
//
// supabaseAdmin is used by runApolloProvider / runDomainSearchProvider for
// org_integrations lookup, quota RPCs, and ai_call_log writes. We expose a
// programmable per-table chain that records ops + returns canned results.

interface AdminCall {
  table: string;
  ops: Array<{ method: string; args: unknown[] }>;
  /** Insert payloads captured from `.insert(row)`. */
  insertRows: unknown[];
  /** Update payloads captured from `.update(patch)`. */
  updatePatches: unknown[];
}

interface RpcCall {
  fn: string;
  args: unknown;
}

const adminState: {
  calls: AdminCall[];
  rpcs: RpcCall[];
  /** Per-table-and-op result the chain resolves to on `await chain`. */
  tableResults: Map<string, { data: unknown; error: unknown }>;
  rpcResults: Map<string, { data: unknown; error: unknown }>;
} = {
  calls: [],
  rpcs: [],
  tableResults: new Map(),
  rpcResults: new Map(),
};

function makeAdminChain(table: string): unknown {
  const call: AdminCall = { table, ops: [], insertRows: [], updatePatches: [] };
  adminState.calls.push(call);

  const fallback = { data: null, error: null };

  const chain: unknown = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => {
            const r = adminState.tableResults.get(table) ?? fallback;
            resolve(r);
          };
        }
        return (...args: unknown[]) => {
          call.ops.push({ method: prop, args });
          if (prop === "insert") call.insertRows.push(args[0]);
          if (prop === "update") call.updatePatches.push(args[0]);
          return chain;
        };
      },
    },
  );
  return chain;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => makeAdminChain(table),
    rpc: async (fn: string, args: unknown) => {
      adminState.rpcs.push({ fn, args });
      return adminState.rpcResults.get(fn) ?? { data: null, error: null };
    },
  },
}));

// --- Stub TanStack server helper used in error path -------------------------

vi.mock("@tanstack/react-start/server", () => ({
  setResponseStatus: vi.fn(),
}));

// --- Imports under test (after mocks) ---------------------------------------

import { _findLeadsHandler } from "../find-leads.functions";
import { recordLeadSync } from "../_lead-sync-log";
import { searchApolloPeople, revealApolloEmail, type ApolloError } from "@/lib/connectors/apollo";
import { searchHunterDomain, type HunterError } from "@/lib/connectors/hunter";
import { searchSnovDomain } from "@/lib/connectors/snov";

const ORG_ID = "00000000-0000-0000-0000-000000000abc";
const USER_ID = "11111111-1111-1111-1111-111111111111";

type HandlerData = Parameters<typeof _findLeadsHandler>[0]["data"];

/** Invoke the handler with sensible defaults for the supabase + user context. */
function callHandler(data: HandlerData) {
  return _findLeadsHandler({
    data,
    context: { supabase: makeRequestClient({}), userId: USER_ID },
  });
}

/**
 * Build the per-request Supabase client stub passed in via `context.supabase`
 * (this is the user-scoped client from requireSupabaseAuth, not the admin).
 *
 * Used for the org-membership + org-token-budget lookups at the top of the
 * handler. Callers pass canned rows.
 */
function makeRequestClient(opts: {
  profile?: { organization_id: string } | null;
  org?: { ai_tokens_used: number; ai_tokens_limit: number } | null;
}) {
  return {
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        async maybeSingle() {
          if (table === "profiles") {
            return { data: opts.profile ?? { organization_id: ORG_ID } };
          }
          if (table === "organizations") {
            return { data: opts.org ?? { ai_tokens_used: 0, ai_tokens_limit: 100 } };
          }
          return { data: null };
        },
      } as unknown as {
        select: () => typeof builder;
        eq: () => typeof builder;
        maybeSingle: () => Promise<{ data: unknown }>;
      };
      return builder;
    },
  };
}

function setTableResult(table: string, data: unknown, error: unknown = null) {
  adminState.tableResults.set(table, { data, error });
}

function setRpcResult(fn: string, data: unknown, error: unknown = null) {
  adminState.rpcResults.set(fn, { data, error });
}

// Sample Apollo person fixture.
function apolloPerson(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "ap_1",
    first_name: "Ada",
    last_name: "Lovelace",
    name: "Ada Lovelace",
    title: "VP of Engineering",
    linkedin_url: "https://linkedin.com/in/ada",
    organization: {
      name: "Analytical Engines",
      industry: "Software",
      estimated_num_employees: 120,
    },
    ...overrides,
  };
}

beforeEach(() => {
  adminState.calls.length = 0;
  adminState.rpcs.length = 0;
  adminState.tableResults.clear();
  adminState.rpcResults.clear();
  vi.clearAllMocks();

  // Default: no BYO integration key (forces platform path for Apollo).
  setTableResult("org_integrations", null);
  // Default platform quota is available.
  setRpcResult("consume_platform_lead_quota", {
    ok: true,
    used: 10,
    quota: 100,
    remaining: 90,
  });
  // ai_tokens increment is a no-op stub.
  setRpcResult("increment_ai_tokens", null);
  // Platform Apollo key present (so we don't crash on missing-platform-key path).
  process.env.PLATFORM_APOLLO_API_KEY = "platform-test-key";
});

describe("findLeads handler — provider routing", () => {
  it("provider=apollo dispatches to Apollo (not Hunter/Snov)", async () => {
    (searchApolloPeople as Mock).mockResolvedValue([apolloPerson()]);
    (revealApolloEmail as Mock).mockResolvedValue({
      email: "ada@analytical.com",
      phone: null,
    });

    const result = await callHandler({
      organizationId: ORG_ID,
      provider: "apollo",
      count: 1,
    } as HandlerData);

    expect(searchApolloPeople).toHaveBeenCalledTimes(1);
    expect(searchHunterDomain).not.toHaveBeenCalled();
    expect(searchSnovDomain).not.toHaveBeenCalled();
    expect(result.meta.provider).toBe("apollo");
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].email).toBe("ada@analytical.com");
  });

  it("provider=hunter dispatches to Hunter (not Apollo/Snov)", async () => {
    // Hunter is BYO-only — install a key row.
    setTableResult("org_integrations", { api_key: "hunter-byo-key" });
    (searchHunterDomain as Mock).mockResolvedValue({
      domain: "stripe.com",
      organization: "Stripe",
      emails: [
        {
          value: "patrick@stripe.com",
          first_name: "Patrick",
          last_name: "Collison",
          position: "CEO",
          confidence: 95,
        },
      ],
    });

    const result = await callHandler({
      organizationId: ORG_ID,
      provider: "hunter",
      companyDomain: "stripe.com",
      count: 5,
    } as HandlerData);

    expect(searchHunterDomain).toHaveBeenCalledTimes(1);
    expect(searchApolloPeople).not.toHaveBeenCalled();
    expect(searchSnovDomain).not.toHaveBeenCalled();
    expect(result.meta.provider).toBe("hunter");
    expect(result.leads[0].email).toBe("patrick@stripe.com");
  });

  it("provider=snov dispatches to Snov (not Apollo/Hunter)", async () => {
    setTableResult("org_integrations", { api_key: "snov_id:snov_secret" });
    (searchSnovDomain as Mock).mockResolvedValue({
      domain: "stripe.com",
      companyName: "Stripe",
      emails: [
        {
          email: "john@stripe.com",
          firstName: "John",
          lastName: "Collison",
          position: "President",
          status: "valid",
        },
      ],
    });

    const result = await callHandler({
      organizationId: ORG_ID,
      provider: "snov",
      companyDomain: "stripe.com",
      count: 3,
    } as HandlerData);

    expect(searchSnovDomain).toHaveBeenCalledTimes(1);
    expect(searchApolloPeople).not.toHaveBeenCalled();
    expect(searchHunterDomain).not.toHaveBeenCalled();
    expect(result.meta.provider).toBe("snov");
    expect(result.leads[0].email).toBe("john@stripe.com");
  });
});

describe("findLeads handler — quota consumption", () => {
  it("calls consume_platform_lead_quota with requested count when no BYO key", async () => {
    (searchApolloPeople as Mock).mockResolvedValue([apolloPerson()]);
    (revealApolloEmail as Mock).mockResolvedValue({
      email: "ada@analytical.com",
      phone: null,
    });

    await callHandler({
      organizationId: ORG_ID,
      provider: "apollo",
      count: 7,
    } as HandlerData);

    const consume = adminState.rpcs.find((r) => r.fn === "consume_platform_lead_quota");
    expect(consume).toBeDefined();
    expect(consume?.args).toMatchObject({ p_org_id: ORG_ID, p_count: 7 });
  });

  it("BYO Apollo key SKIPS platform quota consumption", async () => {
    setTableResult("org_integrations", { api_key: "byo-apollo-key" });
    (searchApolloPeople as Mock).mockResolvedValue([apolloPerson()]);
    (revealApolloEmail as Mock).mockResolvedValue({
      email: "ada@analytical.com",
      phone: null,
    });

    await callHandler({
      organizationId: ORG_ID,
      provider: "apollo",
      count: 3,
    } as HandlerData);

    expect(adminState.rpcs.find((r) => r.fn === "consume_platform_lead_quota")).toBeUndefined();
  });

  it("quota_exceeded throws coded error and logs a quota_exceeded sync row", async () => {
    setRpcResult("consume_platform_lead_quota", {
      ok: false,
      error: "quota_exceeded",
      used: 100,
      quota: 100,
    });

    await expect(
      callHandler({
        organizationId: ORG_ID,
        provider: "apollo",
        count: 5,
      } as HandlerData),
    ).rejects.toThrow(/QUOTA_EXCEEDED/);

    // recordLeadSync called with quota_exceeded status.
    const lastCall = (recordLeadSync as Mock).mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      organizationId: ORG_ID,
      provider: "apollo",
      source: "auto_find_search",
      status: "quota_exceeded",
      errorCode: "QUOTA_EXCEEDED",
    });
  });
});

describe("findLeads handler — sync log row shape", () => {
  it("emits a success row with the documented {provider, op, count, status} fields", async () => {
    (searchApolloPeople as Mock).mockResolvedValue([apolloPerson()]);
    (revealApolloEmail as Mock).mockResolvedValue({
      email: "ada@analytical.com",
      phone: null,
    });

    await callHandler({
      organizationId: ORG_ID,
      provider: "apollo",
      count: 1,
    } as HandlerData);

    const logRow = (recordLeadSync as Mock).mock.calls.at(-1)?.[0];
    // {provider, op, count, status} — `op` is the project's "source" field, the
    // "count" surfaces in `revealed` (delivered leads) and the org id is required.
    expect(logRow).toMatchObject({
      organizationId: ORG_ID,
      userId: USER_ID,
      provider: "apollo",
      source: "auto_find_search",
      status: "success",
      revealed: 1,
    });
    // Metadata mirrors the request shape.
    expect(logRow.metadata).toMatchObject({
      requested_count: 1,
      key_source: "platform",
    });
    // durationMs is non-negative.
    expect(logRow.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("findLeads handler — provider error mapping", () => {
  it("Apollo 429 (rate limit / credit error) surfaces as user-visible error", async () => {
    const err: ApolloError = Object.assign(new Error("Apollo search failed (429): rate limited"), {
      status: 429,
      isAuthError: false,
      isCreditError: true,
    });
    (searchApolloPeople as Mock).mockRejectedValue(err);

    await expect(
      callHandler({
        organizationId: ORG_ID,
        provider: "apollo",
        count: 5,
      } as HandlerData),
    ).rejects.toThrow(/\[PLATFORM_KEY_MISSING\]|out of credits/);

    // A sync log row was written with status=error.
    const logRow = (recordLeadSync as Mock).mock.calls.at(-1)?.[0];
    expect(logRow.status).toBe("error");
    expect(logRow.provider).toBe("apollo");
  });

  it("Hunter 500 (provider error) surfaces as a provider-error message", async () => {
    setTableResult("org_integrations", { api_key: "hunter-byo" });
    const hErr: HunterError = Object.assign(new Error("Hunter domain-search failed (500): boom"), {
      status: 500,
      isAuthError: false,
      isCreditError: false,
    });
    (searchHunterDomain as Mock).mockRejectedValue(hErr);

    await expect(
      callHandler({
        organizationId: ORG_ID,
        provider: "hunter",
        companyDomain: "example.com",
        count: 5,
      } as HandlerData),
    ).rejects.toThrow(/Hunter.*failed|boom/i);

    const logRow = (recordLeadSync as Mock).mock.calls.at(-1)?.[0];
    expect(logRow.status).toBe("error");
    expect(logRow.provider).toBe("hunter");
  });

  it("Apollo 401 (invalid key) on PLATFORM path surfaces PLATFORM_KEY_MISSING", async () => {
    const err: ApolloError = Object.assign(new Error("Apollo search failed (401)"), {
      status: 401,
      isAuthError: true,
      isCreditError: false,
    });
    (searchApolloPeople as Mock).mockRejectedValue(err);

    await expect(
      callHandler({
        organizationId: ORG_ID,
        provider: "apollo",
        count: 3,
      } as HandlerData),
    ).rejects.toThrow(/PLATFORM_KEY_MISSING/);
  });
});

describe("findLeads handler — empty result", () => {
  it("zero leads from Apollo returns success-shape with count=0 + partial log", async () => {
    (searchApolloPeople as Mock).mockResolvedValue([]);

    const result = await callHandler({
      organizationId: ORG_ID,
      provider: "apollo",
      count: 5,
    } as HandlerData);

    expect(result.leads).toEqual([]);
    expect(result.meta.searched).toBe(0);
    expect(result.meta.revealed).toBe(0);
    expect(result.meta.provider).toBe("apollo");

    const logRow = (recordLeadSync as Mock).mock.calls.at(-1)?.[0];
    // Zero leads: status is "partial" per handler logic
    // (`result.leads.length > 0 ? "success" : "partial"`).
    expect(logRow.status).toBe("partial");
    expect(logRow.revealed).toBe(0);
    expect(logRow.fetched).toBe(0);
  });

  it("zero emails from Hunter returns empty leads and a partial sync log", async () => {
    setTableResult("org_integrations", { api_key: "hunter-byo" });
    (searchHunterDomain as Mock).mockResolvedValue({
      domain: "ghost.example",
      organization: "Ghosts Inc",
      emails: [],
    });

    const result = await callHandler({
      organizationId: ORG_ID,
      provider: "hunter",
      companyDomain: "ghost.example",
      count: 5,
    } as HandlerData);

    expect(result.leads).toEqual([]);
    expect(result.meta.searched).toBe(0);

    const logRow = (recordLeadSync as Mock).mock.calls.at(-1)?.[0];
    expect(logRow.status).toBe("partial");
    expect(logRow.revealed).toBe(0);
    expect(logRow.provider).toBe("hunter");
  });
});
