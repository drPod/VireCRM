import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Runs a read-only audit of the main CRM surfaces while signed in as the
 * given (test) credentials. Uses an isolated Supabase client with
 * `persistSession: false` so the caller's own session in the app's
 * singleton client is NOT touched — no logout, no token swap, no leaked
 * storage.
 */

export type AuditCheck = {
  id: string;
  label: string;
  status: "pass" | "fail";
  detail?: string;
  ms: number;
};

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Probe = {
  id: string;
  label: string;
  table: keyof Database["public"]["Tables"];
};

const PROBES: Probe[] = [
  { id: "leads", label: "Leads visible", table: "leads" },
  { id: "appointments", label: "Appointments visible", table: "appointments" },
  { id: "conversations", label: "Conversations visible", table: "conversations" },
  { id: "admin_quotes", label: "Quotes visible", table: "admin_quotes" },
  { id: "outreach_sequences", label: "Outreach sequences visible", table: "outreach_sequences" },
  { id: "outreach_templates", label: "Outreach templates visible", table: "outreach_templates" },
  { id: "organizations", label: "Organization profile readable", table: "organizations" },
];

export async function runAuditAs(
  email: string,
  password: string,
): Promise<AuditCheck[]> {
  // Isolated client — does NOT persist session anywhere, does NOT share
  // storage with the app's singleton supabase client.
  const client = createClient<Database>(URL, KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  });

  const results: AuditCheck[] = [];
  const time = async (
    id: string,
    label: string,
    fn: () => Promise<string>,
  ) => {
    const t0 = performance.now();
    try {
      const detail = await fn();
      results.push({
        id,
        label,
        status: "pass",
        detail,
        ms: Math.round(performance.now() - t0),
      });
    } catch (e) {
      results.push({
        id,
        label,
        status: "fail",
        detail: e instanceof Error ? e.message : String(e),
        ms: Math.round(performance.now() - t0),
      });
    }
  };

  await time("auth", "Sign in as test account", async () => {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.session) throw new Error("no session returned");
    return `uid ${data.user!.id.slice(0, 8)}…`;
  });

  // If sign-in failed, every other probe will fail with no auth — stop here
  // to avoid a wall of useless 401s.
  if (results[0].status === "fail") {
    try {
      await client.auth.signOut();
    } catch {
      /* ignore */
    }
    return results;
  }

  await time("profile", "Profile + organization linked", async () => {
    const { data, error } = await client
      .from("profiles")
      .select("organization_id, full_name")
      .maybeSingle();
    if (error) throw error;
    if (!data?.organization_id) throw new Error("no organization on profile");
    return `org ${data.organization_id.slice(0, 8)}…`;
  });

  for (const probe of PROBES) {
    await time(probe.id, probe.label, async () => {
      // Cast to any: PROBES intentionally enumerates many tables, which
      // overwhelms the generated row-typing union otherwise.
      const { error, count } = await (client.from as unknown as (
        t: string,
      ) => {
        select: (
          c: string,
          o: { count: "exact"; head: true },
        ) => Promise<{ error: { message: string } | null; count: number | null }>;
      })(probe.table).select("*", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `${count ?? 0} row(s) visible via RLS`;
    });
  }

  // Cleanly end the isolated session.
  try {
    await client.auth.signOut();
  } catch {
    /* ignore */
  }

  return results;
}
