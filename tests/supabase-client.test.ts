import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetSupabaseBrowserClientForTests,
  getSupabaseBrowserClient,
} from "../app/lib/supabase.client";

// `@supabase/supabase-js` is browser-targeted. Inside the Workers test pool
// we can still call `createClient` because it does no network work at
// construction time — it just builds an in-memory client. The tests below
// exercise the singleton + env-validation contract of our wrapper, not the
// Supabase SDK itself.

describe("getSupabaseBrowserClient", () => {
  beforeEach(() => {
    __resetSupabaseBrowserClientForTests();
    vi.stubEnv("VITE_SUPABASE_URL", "https://test-project.supabase.co");
    vi.stubEnv(
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_test_key_for_singleton_check",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    __resetSupabaseBrowserClientForTests();
  });

  it("returns a client instance when env vars are set", () => {
    const client = getSupabaseBrowserClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(typeof client.auth.signInWithPassword).toBe("function");
    expect(typeof client.auth.signOut).toBe("function");
  });

  it("returns the same singleton across calls", () => {
    const a = getSupabaseBrowserClient();
    const b = getSupabaseBrowserClient();
    expect(a).toBe(b);
  });

  it("rebuilds after the test reset helper is called", () => {
    const a = getSupabaseBrowserClient();
    __resetSupabaseBrowserClientForTests();
    const b = getSupabaseBrowserClient();
    expect(a).not.toBe(b);
  });

  it("throws a clear error when VITE_SUPABASE_URL is missing", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    expect(() => getSupabaseBrowserClient()).toThrow(/VITE_SUPABASE_URL/);
  });

  it("throws a clear error when VITE_SUPABASE_PUBLISHABLE_KEY is missing", () => {
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => getSupabaseBrowserClient()).toThrow(
      /VITE_SUPABASE_PUBLISHABLE_KEY/,
    );
  });
});
