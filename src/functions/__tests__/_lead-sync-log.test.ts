/**
 * Unit tests for `recordLeadSync` — the best-effort audit-log writer for
 * `lead_sync_log`. Contract: NEVER throw. Caller flow must not break when the
 * audit insert fails. Errors get surfaced to the server console only.
 *
 * Coverage:
 * - Happy path: insert succeeds → no throw, no console.error.
 * - DB error swallowed: insert resolves with `{ error }` → no throw,
 *   `console.error` called with the error message.
 * - Unexpected exception swallowed: insert throws → no throw,
 *   `console.error` called with the thrown error.
 * - Row shape: snake_case column mapping with sensible defaults for
 *   numeric counters + nullable text fields.
 * - Optional metadata: when supplied, passed through; when omitted, null.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

interface InsertedRow {
  table: string;
  row: Record<string, unknown>;
}

const inserted: InsertedRow[] = [];

// Behaviour the mocked insert exhibits per-test. Default = success.
let insertBehaviour:
  | { kind: "ok" }
  | { kind: "dbError"; message: string }
  | { kind: "throw"; err: unknown } = { kind: "ok" };

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        inserted.push({ table, row });
        if (insertBehaviour.kind === "throw") {
          throw insertBehaviour.err;
        }
        if (insertBehaviour.kind === "dbError") {
          return { error: { message: insertBehaviour.message } };
        }
        return { error: null };
      },
    }),
  },
}));

beforeEach(() => {
  inserted.length = 0;
  insertBehaviour = { kind: "ok" };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Read the single recorded `console.error` call as `[prefix, payload]`. */
function singleErrorCall(): [unknown, unknown] {
  const consoleError = vi.mocked(console.error);
  expect(consoleError).toHaveBeenCalledTimes(1);
  const [prefix, payload] = consoleError.mock.calls[0];
  return [prefix, payload];
}

const ORG_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-0000000000bb";

describe("recordLeadSync", () => {
  it("happy path: writes a row to lead_sync_log and does not throw", async () => {
    const { recordLeadSync } = await import("../_lead-sync-log");

    await expect(
      recordLeadSync({
        organizationId: ORG_ID,
        userId: USER_ID,
        provider: "apollo",
        source: "auto_find",
        status: "success",
        fetched: 10,
        inserted: 7,
        durationMs: 1234,
      }),
    ).resolves.toBeUndefined();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].table).toBe("lead_sync_log");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("row shape: maps camelCase entry to snake_case columns with defaults", async () => {
    const { recordLeadSync } = await import("../_lead-sync-log");

    await recordLeadSync({
      organizationId: ORG_ID,
      userId: USER_ID,
      provider: "hunter",
      source: "apollo_list_import",
      status: "partial",
      fetched: 50,
      revealed: 40,
      inserted: 30,
      updated: 5,
      duplicates: 4,
      noEmail: 1,
      durationMs: 9876,
      errorCode: "RATE_LIMITED",
      errorMessage: "rate limited by provider",
    });

    expect(inserted).toHaveLength(1);
    const row = inserted[0].row;

    // Snake-case mapping for every field the caller supplied.
    expect(row).toMatchObject({
      organization_id: ORG_ID,
      user_id: USER_ID,
      provider: "hunter",
      source: "apollo_list_import",
      status: "partial",
      fetched: 50,
      revealed: 40,
      inserted: 30,
      updated: 5,
      duplicates: 4,
      no_email: 1,
      duration_ms: 9876,
      error_code: "RATE_LIMITED",
      error_message: "rate limited by provider",
      metadata: null,
    });
  });

  it("defaults: numeric counters default to 0 and nullable text to null", async () => {
    const { recordLeadSync } = await import("../_lead-sync-log");

    await recordLeadSync({
      organizationId: ORG_ID,
      // userId omitted → null
      provider: "snov",
      source: "auto_find",
      status: "success",
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].row).toMatchObject({
      organization_id: ORG_ID,
      user_id: null,
      provider: "snov",
      source: "auto_find",
      status: "success",
      fetched: 0,
      revealed: 0,
      inserted: 0,
      updated: 0,
      duplicates: 0,
      no_email: 0,
      duration_ms: 0,
      error_code: null,
      error_message: null,
      metadata: null,
    });
  });

  it("optional metadata: serialized through to the row when supplied", async () => {
    const { recordLeadSync } = await import("../_lead-sync-log");
    const meta = { list_id: "abc-123", search_term: "solar installers" };

    await recordLeadSync({
      organizationId: ORG_ID,
      provider: "apollo",
      source: "apollo_list_import",
      status: "success",
      metadata: meta,
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].row.metadata).toEqual(meta);
  });

  it("swallows DB error: returns { error } → logs but does not throw", async () => {
    const { recordLeadSync } = await import("../_lead-sync-log");
    insertBehaviour = { kind: "dbError", message: "permission denied" };

    await expect(
      recordLeadSync({
        organizationId: ORG_ID,
        provider: "apollo",
        source: "auto_find",
        status: "error",
        errorCode: "BOOM",
        errorMessage: "kaboom",
      }),
    ).resolves.toBeUndefined();

    const [prefix, payload] = singleErrorCall();
    expect(prefix).toMatch(/lead_sync_log.*insert failed/);
    expect(payload).toBe("permission denied");
  });

  it("swallows thrown exception: insert throws → does not throw, logs error", async () => {
    const { recordLeadSync } = await import("../_lead-sync-log");
    const boom = new Error("network down");
    insertBehaviour = { kind: "throw", err: boom };

    await expect(
      recordLeadSync({
        organizationId: ORG_ID,
        provider: "apollo",
        source: "auto_find",
        status: "error",
      }),
    ).resolves.toBeUndefined();

    const [prefix, payload] = singleErrorCall();
    expect(prefix).toMatch(/lead_sync_log.*unexpected error/);
    expect(payload).toBe(boom);
  });

  it("never throws even when called with a quota_exceeded status", async () => {
    const { recordLeadSync } = await import("../_lead-sync-log");

    await expect(
      recordLeadSync({
        organizationId: ORG_ID,
        provider: "hunter",
        source: "auto_find",
        status: "quota_exceeded",
        errorCode: "QUOTA",
        errorMessage: "monthly quota exhausted",
      }),
    ).resolves.toBeUndefined();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].row.status).toBe("quota_exceeded");
  });
});
