/**
 * Unit tests for `src/lib/auth-helpers.ts`.
 *
 * Both exported helpers (`assertOrgMember`, `assertOwner`) accept the Supabase
 * client as an argument, so we don't need `vi.mock` — we pass a recording fake
 * directly. The fake builds a chainable Proxy that records every call (so we
 * can assert table/filter shape) and resolves the terminal `.maybeSingle()` to
 * a per-test configurable `{ data, error }` result.
 *
 * Pattern adapted from `pipeline-org-scoping.test.ts:54-62`. Difference: the
 * pipeline-org test only cares about WHICH ops were called; here we also need
 * to control what the await resolves to, so the chain holds a mutable result.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertOrgMember, assertOwner } from "../auth-helpers";

interface RecordedCall {
  table: string;
  ops: Array<{ method: string; args: unknown[] }>;
}

interface MaybeSingleResult {
  data: unknown;
  error: unknown;
}

/**
 * Build a fake SupabaseClient whose `.from(table).<chain>...maybeSingle()`
 * resolves to `result`. Each `.from()` call appends a `RecordedCall` to
 * `recorded` so tests can assert which table was queried and which filters
 * were applied.
 */
function makeFakeClient(
  result: MaybeSingleResult,
  recorded: RecordedCall[],
): SupabaseClient {
  const fromImpl = (table: string) => {
    const call: RecordedCall = { table, ops: [] };
    recorded.push(call);

    const chain: any = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
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
  };

  return { from: fromImpl } as unknown as SupabaseClient;
}

function eqCallsOf(call: RecordedCall): Array<{ method: string; args: unknown[] }> {
  return call.ops.filter((op) => op.method === "eq");
}

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ORG_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_ORG_ID = "33333333-3333-3333-3333-333333333333";

let recorded: RecordedCall[];

beforeEach(() => {
  recorded = [];
});

describe("assertOrgMember", () => {
  it("happy path: returns void when profile's organization_id matches", async () => {
    const client = makeFakeClient(
      { data: { organization_id: ORG_ID }, error: null },
      recorded,
    );

    await expect(assertOrgMember(client, USER_ID, ORG_ID)).resolves.toBeUndefined();

    // Confirm the query shape: `profiles` table, filtered by user_id.
    expect(recorded).toHaveLength(1);
    expect(recorded[0].table).toBe("profiles");
    expect(eqCallsOf(recorded[0])).toContainEqual({
      method: "eq",
      args: ["user_id", USER_ID],
    });
    expect(recorded[0].ops.some((op) => op.method === "select")).toBe(true);
    expect(recorded[0].ops.some((op) => op.method === "maybeSingle")).toBe(true);
  });

  it("throws when profile row exists but org doesn't match", async () => {
    const client = makeFakeClient(
      { data: { organization_id: OTHER_ORG_ID }, error: null },
      recorded,
    );

    await expect(assertOrgMember(client, USER_ID, ORG_ID)).rejects.toThrow(
      "Unauthorized: not a member of this organization",
    );
  });

  it("throws when no profile row exists for the user (data === null)", async () => {
    const client = makeFakeClient({ data: null, error: null }, recorded);

    await expect(assertOrgMember(client, USER_ID, ORG_ID)).rejects.toThrow(
      "Unauthorized: not a member of this organization",
    );
  });

  it("throws when profile row has null organization_id", async () => {
    const client = makeFakeClient(
      { data: { organization_id: null }, error: null },
      recorded,
    );

    await expect(assertOrgMember(client, USER_ID, ORG_ID)).rejects.toThrow(
      "Unauthorized: not a member of this organization",
    );
  });

  it("throws when Supabase returns an error (data is null in that case)", async () => {
    // Supabase contract: on error, `data` is null. The current helper only
    // looks at `data`, so this surfaces the same Unauthorized error rather
    // than propagating the raw PostgrestError — locking that behaviour in.
    const client = makeFakeClient(
      { data: null, error: { message: "RLS violation", code: "42501" } },
      recorded,
    );

    await expect(assertOrgMember(client, USER_ID, ORG_ID)).rejects.toThrow(
      "Unauthorized: not a member of this organization",
    );
  });

  it("treats empty-string orgId as a mismatch (validation-edge)", async () => {
    // Defensive: a caller that forgets to pass orgId should NOT pass
    // membership just because data.organization_id happens to be falsy.
    const client = makeFakeClient(
      { data: { organization_id: ORG_ID }, error: null },
      recorded,
    );

    await expect(assertOrgMember(client, USER_ID, "")).rejects.toThrow(
      "Unauthorized: not a member of this organization",
    );
  });
});

describe("assertOwner", () => {
  it("happy path: returns void when an owner role row exists", async () => {
    const client = makeFakeClient(
      { data: { role: "owner" }, error: null },
      recorded,
    );

    await expect(assertOwner(client, USER_ID, ORG_ID)).resolves.toBeUndefined();

    // Confirm the query shape: `user_roles` filtered by user_id + org + role.
    expect(recorded).toHaveLength(1);
    expect(recorded[0].table).toBe("user_roles");
    const eqCalls = eqCallsOf(recorded[0]);
    expect(eqCalls).toContainEqual({ method: "eq", args: ["user_id", USER_ID] });
    expect(eqCalls).toContainEqual({
      method: "eq",
      args: ["organization_id", ORG_ID],
    });
    expect(eqCalls).toContainEqual({ method: "eq", args: ["role", "owner"] });
  });

  it("throws when no owner row exists (data === null)", async () => {
    const client = makeFakeClient({ data: null, error: null }, recorded);

    await expect(assertOwner(client, USER_ID, ORG_ID)).rejects.toThrow(
      "Only organization owners can perform this action",
    );
  });

  it("throws when Supabase returns an error", async () => {
    // Same lock-in as the assertOrgMember error case: error surfaces as the
    // not-an-owner message because the helper only inspects `data`.
    const client = makeFakeClient(
      { data: null, error: { message: "permission denied", code: "42501" } },
      recorded,
    );

    await expect(assertOwner(client, USER_ID, ORG_ID)).rejects.toThrow(
      "Only organization owners can perform this action",
    );
  });

  it("does NOT cross-filter: missing orgId still routes through user_roles", async () => {
    // Caller passes empty orgId — the chain still executes against
    // user_roles. Because the empty `.eq("organization_id", "")` won't match
    // any row in production, the helper rejects with the owner-only message.
    const client = makeFakeClient({ data: null, error: null }, recorded);

    await expect(assertOwner(client, USER_ID, "")).rejects.toThrow(
      "Only organization owners can perform this action",
    );

    expect(recorded[0].table).toBe("user_roles");
    expect(eqCallsOf(recorded[0])).toContainEqual({
      method: "eq",
      args: ["organization_id", ""],
    });
  });
});
