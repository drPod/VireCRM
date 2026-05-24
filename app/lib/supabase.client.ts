// Browser-only Supabase client. Singleton so multiple route imports share one
// auth + storage instance (otherwise each call to `createClient` builds a fresh
// `localStorage`-backed session store that drifts out of sync with the others).
//
// React Router v7 strips `*.client.ts` from the SSR bundle — this module never
// runs in the Worker. The Worker has its own `@supabase/server` flow for JWT
// verification; this lib is strictly for the browser login form.
//
// Public env (`VITE_*` prefix → exposed to browser by Vite). NEVER place the
// service-role key here — it would ship to every browser.
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Lazy-initialized browser Supabase client. Reads `VITE_SUPABASE_URL` +
 * `VITE_SUPABASE_PUBLISHABLE_KEY` from Vite's `import.meta.env` on first call.
 * Throws if either is missing — fail loudly per repo convention (no silent
 * fallbacks).
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;

  const url = readRequiredEnv("VITE_SUPABASE_URL");
  const publishableKey = readRequiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

  cached = createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return cached;
}

function readRequiredEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY"): string {
  const value = import.meta.env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `${name} is not set. Add it to .env.development (local) or the deploy env (prod). See .env.example.`,
    );
  }
  return value;
}

/**
 * Test-only: drop the cached client so a fresh one is built on the next call.
 * Not exported in the public surface for app code — call sites should treat
 * the singleton as immutable.
 */
export function __resetSupabaseBrowserClientForTests(): void {
  cached = null;
}
