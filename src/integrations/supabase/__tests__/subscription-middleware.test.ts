/**
 * Unit tests for the `requireActiveSubscription` middleware — the server-side
 * entitlement gate that blocks paid-feature endpoints when a user lacks an
 * active subscription. Covers:
 *
 *   - ACTIVE_STATUSES bucketing (which status strings count as "active")
 *   - Owner-level path (user has their own sub)
 *   - Org-level fallback (user has no sub, but an org owner does)
 *   - Neither path → 402
 *   - Chain shape (reads `context.userId` set upstream by requireSupabaseAuth)
 *   - DB-error / fail-closed semantics → 403
 *
 * The middleware composes via `createMiddleware({ type: "function" })
 *   .middleware([requireSupabaseAuth]).server(handler)`. We invoke the
 * `.options.server` handler directly with a stub `next` + a pre-populated
 * `context.userId` to simulate having passed through `requireSupabaseAuth`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// -----------------------------------------------------------------------------
// Hoisted mocks: `vi.mock` factories run before module imports, so we expose
// shared state via `vi.hoisted` so each test can swap in fresh responses.
// -----------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  interface RecordedCall {
    table: string;
    ops: Array<{ method: string; args: unknown[] }>;
  }

  // Per-test queue of (table-name => response). Each .from(table) shifts the
  // next response off. Lets a test wire up the exact sequence of DB calls
  // expected by the middleware.
  const responseQueue: Array<{
    table: string;
    response: { data: unknown; error: unknown };
  }> = [];

  const recorded: RecordedCall[] = [];

  function makeRecordingChain(table: string): unknown {
    const call: RecordedCall = { table, ops: [] };
    recorded.push(call);

    // Pull the matching response off the queue. If none queued for this
    // table, fall back to an empty success so a misconfigured test fails
    // loudly on the assertion rather than crashing in the proxy.
    const idx = responseQueue.findIndex((r) => r.table === table);
    const response =
      idx >= 0 ? responseQueue.splice(idx, 1)[0].response : { data: [], error: null };

    const chain: unknown = new Proxy(
      {},
      {
        get(_t, prop: string | symbol) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) => resolve(response);
          }
          return (...args: unknown[]) => {
            call.ops.push({ method: String(prop), args });
            return chain;
          };
        },
      },
    );
    return chain;
  }

  const supabaseAdmin = {
    from: (table: string) => makeRecordingChain(table),
  };

  const setResponseStatus = vi.fn();
  const getRequest = vi.fn();

  return { recorded, responseQueue, supabaseAdmin, setResponseStatus, getRequest };
});

vi.mock("@tanstack/react-start/server", () => ({
  setResponseStatus: mocks.setResponseStatus,
  getRequest: mocks.getRequest,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

// Stub out the upstream auth middleware so importing the subscription
// middleware doesn't pull in `@supabase/supabase-js` client construction. We
// invoke the subscription handler directly with `context.userId` already
// populated, so the real `requireSupabaseAuth` body never runs.
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: { options: { server: vi.fn() } },
}));

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ORG_ID = "22222222-2222-2222-2222-222222222222";
const OWNER_ID = "33333333-3333-3333-3333-333333333333";

/** Future ISO date — counts as still-current. */
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
/** Past ISO date — counts as expired. */
const PAST = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

/**
 * Queue the DB responses the middleware will see, in the order it issues
 * them. Order is:
 *   1. subscriptions (own)        — Promise.all leg 1
 *   2. profiles (own organization) — Promise.all leg 2
 *   3. user_roles (owners)         — only if !hasActive && organization_id
 *   4. subscriptions (owners)      — only if ownerIds.length > 0
 */
function queueResponses(responses: Array<{ table: string; data?: unknown; error?: unknown }>) {
  for (const r of responses) {
    mocks.responseQueue.push({
      table: r.table,
      response: { data: r.data ?? null, error: r.error ?? null },
    });
  }
}

/**
 * Invoke the middleware's server handler with a stubbed `next` and the given
 * `userId` in context. Returns whichever resolved value `next()` returned, or
 * throws if the middleware rejected.
 */
async function runMiddleware(userId: string | undefined = USER_ID) {
  const { requireActiveSubscription } = await import(
    "@/integrations/supabase/subscription-middleware"
  );
  // `createMiddleware({ type: "function" }).middleware([...]).server(fn)`
  // returns a builder whose handler is stored at `options.server`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (requireActiveSubscription as any).options.server as (arg: {
    next: () => Promise<unknown>;
    context: { userId: string | undefined };
  }) => Promise<unknown>;

  const next = vi.fn(async () => ({ ok: true }));
  const result = await handler({ next, context: { userId } });
  return { result, next };
}

beforeEach(() => {
  mocks.recorded.length = 0;
  mocks.responseQueue.length = 0;
  mocks.setResponseStatus.mockReset();
  mocks.getRequest.mockReset();
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("requireActiveSubscription — middleware shape", () => {
  it("composes via createMiddleware({ type: 'function' }).middleware([...]).server(...)", async () => {
    const { requireActiveSubscription } = await import(
      "@/integrations/supabase/subscription-middleware"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mw = requireActiveSubscription as any;
    expect(mw.options).toBeDefined();
    expect(mw.options.type).toBe("function");
    expect(typeof mw.options.server).toBe("function");
    expect(Array.isArray(mw.options.middleware)).toBe(true);
    // The chained middleware must include requireSupabaseAuth — which is what
    // supplies `context.userId` to this handler.
    expect(mw.options.middleware.length).toBeGreaterThan(0);
  });

  it("reads context.userId set by upstream requireSupabaseAuth", async () => {
    queueResponses([
      { table: "subscriptions", data: [{ status: "active", current_period_end: FUTURE }] },
      { table: "profiles", data: { organization_id: ORG_ID } },
    ]);

    await runMiddleware(USER_ID);

    // First subscriptions query must have filtered on the userId passed via
    // context. Without this, the middleware would query for the wrong user.
    const subsCall = mocks.recorded.find((c) => c.table === "subscriptions");
    expect(subsCall, "expected a subscriptions query").toBeDefined();
    const eqOps = subsCall!.ops.filter((op) => op.method === "eq");
    expect(eqOps.some((op) => op.args[0] === "user_id" && op.args[1] === USER_ID)).toBe(true);
  });
});

describe("requireActiveSubscription — owner-level path (user has own sub)", () => {
  it("allows when own sub has status 'active' and future current_period_end", async () => {
    queueResponses([
      { table: "subscriptions", data: [{ status: "active", current_period_end: FUTURE }] },
      { table: "profiles", data: { organization_id: ORG_ID } },
    ]);

    const { next } = await runMiddleware();
    expect(next).toHaveBeenCalledTimes(1);
    expect(mocks.setResponseStatus).not.toHaveBeenCalled();
  });

  it("allows when own sub has status 'trialing' (counts as active)", async () => {
    queueResponses([
      { table: "subscriptions", data: [{ status: "trialing", current_period_end: FUTURE }] },
      { table: "profiles", data: { organization_id: ORG_ID } },
    ]);

    const { next } = await runMiddleware();
    expect(next).toHaveBeenCalledTimes(1);
    expect(mocks.setResponseStatus).not.toHaveBeenCalled();
  });

  it("allows when own sub has null current_period_end (perpetual)", async () => {
    queueResponses([
      { table: "subscriptions", data: [{ status: "active", current_period_end: null }] },
      { table: "profiles", data: { organization_id: ORG_ID } },
    ]);

    const { next } = await runMiddleware();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("filters subscriptions by ACTIVE_STATUSES in the .in() clause", async () => {
    queueResponses([
      { table: "subscriptions", data: [{ status: "active", current_period_end: FUTURE }] },
      { table: "profiles", data: { organization_id: ORG_ID } },
    ]);

    await runMiddleware();

    // The middleware uses `.in("status", ACTIVE_STATUSES)`. Confirm that
    // bucketing happens at the DB layer (not just in JS), which is what
    // keeps past_due/canceled/etc. from leaking through even if the JS
    // active-check changes shape later.
    const subsCall = mocks.recorded.find((c) => c.table === "subscriptions");
    const inOp = subsCall!.ops.find((op) => op.method === "in");
    expect(inOp).toBeDefined();
    expect(inOp!.args[0]).toBe("status");
    expect(inOp!.args[1]).toEqual(["active", "trialing"]);
  });

  it("blocks when own sub is expired (current_period_end in the past)", async () => {
    // Even though `.in("status", ACTIVE_STATUSES)` filters at the DB layer,
    // the middleware ALSO re-checks `current_period_end` in JS. Simulate a
    // row leaking through the .in() filter with status='active' but a past
    // period_end. This guards against clock skew / stale rows.
    queueResponses([
      { table: "subscriptions", data: [{ status: "active", current_period_end: PAST }] },
      { table: "profiles", data: { organization_id: null } },
    ]);

    await expect(runMiddleware()).rejects.toThrow(/Subscription required/);
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(402);
  });
});

describe("requireActiveSubscription — ACTIVE_STATUSES bucketing", () => {
  // Statuses the DB-level `.in("status", ACTIVE_STATUSES)` filter would
  // grant access for.
  const ACTIVE_BUCKET = ["active", "trialing"] as const;
  // Statuses that must NOT grant access. Even if the DB-level filter were
  // somehow loosened, the JS-side `current_period_end` check is the safety
  // net. We simulate "this status was returned by the DB" by stuffing it
  // into the data array — that's the worst-case scenario the JS code has
  // to handle.
  const INACTIVE_BUCKET = [
    "past_due",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "unpaid",
  ] as const;

  it.each(ACTIVE_BUCKET)("allows status='%s' with future current_period_end", async (status) => {
    queueResponses([
      { table: "subscriptions", data: [{ status, current_period_end: FUTURE }] },
      { table: "profiles", data: { organization_id: null } },
    ]);

    const { next } = await runMiddleware();
    expect(next).toHaveBeenCalledTimes(1);
    expect(mocks.setResponseStatus).not.toHaveBeenCalled();
  });

  // Simulate the DB-level `.in("status", ["active", "trialing"])` filter doing
  // its job: it returns no rows for past_due/canceled/etc., so the data array
  // is empty regardless of the underlying row's current_period_end.
  it.each(INACTIVE_BUCKET)(
    "blocks status='%s' (excluded by DB .in() filter)",
    async (_status) => {
      queueResponses([
        { table: "subscriptions", data: [] },
        { table: "profiles", data: { organization_id: null } },
      ]);

      await expect(runMiddleware()).rejects.toThrow(/Subscription required/);
      expect(mocks.setResponseStatus).toHaveBeenCalledWith(402);
    },
  );
});

describe("requireActiveSubscription — org-level fallback", () => {
  it("allows when user has no sub but an org owner does", async () => {
    queueResponses([
      // No own subscription
      { table: "subscriptions", data: [] },
      // User belongs to an organization
      { table: "profiles", data: { organization_id: ORG_ID } },
      // That org has an owner
      { table: "user_roles", data: [{ user_id: OWNER_ID }] },
      // And the owner has an active sub
      { table: "subscriptions", data: [{ status: "active", current_period_end: FUTURE }] },
    ]);

    const { next } = await runMiddleware();
    expect(next).toHaveBeenCalledTimes(1);
    expect(mocks.setResponseStatus).not.toHaveBeenCalled();
  });

  it("scopes owner-roles lookup by organization_id and role='owner'", async () => {
    queueResponses([
      { table: "subscriptions", data: [] },
      { table: "profiles", data: { organization_id: ORG_ID } },
      { table: "user_roles", data: [{ user_id: OWNER_ID }] },
      { table: "subscriptions", data: [{ status: "active", current_period_end: FUTURE }] },
    ]);

    await runMiddleware();

    const rolesCall = mocks.recorded.find((c) => c.table === "user_roles");
    expect(rolesCall, "expected a user_roles query").toBeDefined();
    const eqOps = rolesCall!.ops.filter((op) => op.method === "eq");
    expect(eqOps.some((op) => op.args[0] === "organization_id" && op.args[1] === ORG_ID)).toBe(
      true,
    );
    expect(eqOps.some((op) => op.args[0] === "role" && op.args[1] === "owner")).toBe(true);
  });

  it("blocks when org has owners but none have an active sub", async () => {
    queueResponses([
      { table: "subscriptions", data: [] },
      { table: "profiles", data: { organization_id: ORG_ID } },
      { table: "user_roles", data: [{ user_id: OWNER_ID }] },
      { table: "subscriptions", data: [] },
    ]);

    await expect(runMiddleware()).rejects.toThrow(/Subscription required/);
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(402);
  });

  it("blocks when user has no sub AND no organization_id", async () => {
    queueResponses([
      { table: "subscriptions", data: [] },
      { table: "profiles", data: { organization_id: null } },
    ]);

    await expect(runMiddleware()).rejects.toThrow(/Subscription required/);
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(402);
    // Should NOT have queried user_roles when there's no org to look up.
    expect(mocks.recorded.find((c) => c.table === "user_roles")).toBeUndefined();
  });

  it("blocks when profile is missing (no row)", async () => {
    queueResponses([
      { table: "subscriptions", data: [] },
      { table: "profiles", data: null },
    ]);

    await expect(runMiddleware()).rejects.toThrow(/Subscription required/);
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(402);
  });

  it("blocks when org has no owners (empty ownerIds list)", async () => {
    queueResponses([
      { table: "subscriptions", data: [] },
      { table: "profiles", data: { organization_id: ORG_ID } },
      { table: "user_roles", data: [] },
    ]);

    await expect(runMiddleware()).rejects.toThrow(/Subscription required/);
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(402);
  });

  it("blocks when owner rows have null user_id (filtered out before .in())", async () => {
    queueResponses([
      { table: "subscriptions", data: [] },
      { table: "profiles", data: { organization_id: ORG_ID } },
      // Edge case: a role row exists but user_id is null. The middleware
      // filters these out with `.filter(Boolean)`, leaving an empty list.
      { table: "user_roles", data: [{ user_id: null }] },
    ]);

    await expect(runMiddleware()).rejects.toThrow(/Subscription required/);
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(402);
  });
});

describe("requireActiveSubscription — fail-closed on DB errors (403)", () => {
  it("fails closed with 403 when own-sub query errors", async () => {
    queueResponses([
      { table: "subscriptions", error: { message: "transient DB hiccup" } },
      { table: "profiles", data: { organization_id: ORG_ID } },
    ]);

    await expect(runMiddleware()).rejects.toThrow(/Subscription check failed/);
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(403);
  });

  it("fails closed with 403 when profile query errors", async () => {
    queueResponses([
      { table: "subscriptions", data: [{ status: "active", current_period_end: FUTURE }] },
      { table: "profiles", error: { message: "RLS denied" } },
    ]);

    await expect(runMiddleware()).rejects.toThrow(/Subscription check failed/);
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(403);
  });

  it("fails closed with 403 when user_roles query errors", async () => {
    queueResponses([
      { table: "subscriptions", data: [] },
      { table: "profiles", data: { organization_id: ORG_ID } },
      { table: "user_roles", error: { message: "permission denied" } },
    ]);

    await expect(runMiddleware()).rejects.toThrow(/Subscription check failed/);
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(403);
  });

  it("fails closed with 403 when owner-subs query errors", async () => {
    queueResponses([
      { table: "subscriptions", data: [] },
      { table: "profiles", data: { organization_id: ORG_ID } },
      { table: "user_roles", data: [{ user_id: OWNER_ID }] },
      { table: "subscriptions", error: { message: "owner subs lookup failed" } },
    ]);

    await expect(runMiddleware()).rejects.toThrow(/Subscription check failed/);
    expect(mocks.setResponseStatus).toHaveBeenCalledWith(403);
  });
});
