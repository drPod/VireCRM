import { createClient, type PostgrestError, AuthError } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Runs a read-only audit of the main CRM surfaces while signed in as the
 * given (test) credentials. Uses an isolated Supabase client with
 * `persistSession: false` so the caller's own session in the app's
 * singleton client is NOT touched — no logout, no token swap, no leaked
 * storage.
 *
 * On failure, captures the full PostgREST/Auth error envelope so the UI can
 * render the exact RLS denial reason (Postgres SQLSTATE, hint, details) and
 * a best-guess of which policy/check failed.
 */

export type AuditFailure = {
  message: string;
  /** Postgres SQLSTATE, e.g. "42501" for RLS denial, "PGRST116" no rows */
  code?: string;
  hint?: string;
  details?: string;
  /** HTTP status surfaced by PostgREST/GoTrue, when present */
  status?: number;
  /** Table the probe ran against */
  table?: string;
  /** SQL operation attempted */
  operation?: "select" | "insert" | "update" | "delete" | "auth";
  /** Best-effort guess at the failing policy / RLS cause */
  policyHint?: string;
};

export type AuditCheck = {
  id: string;
  label: string;
  status: "pass" | "fail";
  detail?: string;
  ms: number;
  failure?: AuditFailure;
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

/**
 * Map a Postgres/PostgREST error code into a human-readable hint about
 * which RLS gate likely tripped. We can't read pg_policies as the test user,
 * so this is a best-effort interpretation of the SQLSTATE.
 */
function explainPolicy(
  code: string | undefined,
  table: string | undefined,
  operation: AuditFailure["operation"],
): string | undefined {
  if (!code) return undefined;
  switch (code) {
    case "42501":
      return `RLS denied ${operation ?? "operation"} on ${table ?? "table"} — no matching policy granted access (or "USING (false)" base policy is intentionally blocking direct reads).`;
    case "PGRST301":
      return `JWT rejected by PostgREST when querying ${table ?? "table"} — token expired or signing key mismatch.`;
    case "PGRST116":
      return `Single-row query returned 0 rows on ${table ?? "table"} — RLS may be filtering out every row even though SELECT is permitted.`;
    case "42P01":
      return `Table ${table ?? "?"} does not exist or is not exposed in the PostgREST schema.`;
    case "42703":
      return `Column referenced by an RLS policy on ${table ?? "?"} no longer exists — policy is broken.`;
    default:
      return undefined;
  }
}

function fromPostgrest(
  err: PostgrestError,
  table: string,
  operation: AuditFailure["operation"],
): AuditFailure {
  return {
    message: err.message,
    code: err.code ?? undefined,
    hint: err.hint ?? undefined,
    details: err.details ?? undefined,
    table,
    operation,
    policyHint: explainPolicy(err.code, table, operation),
  };
}

function fromAuth(err: AuthError): AuditFailure {
  return {
    message: err.message,
    code: (err as AuthError & { code?: string }).code,
    status: err.status,
    operation: "auth",
  };
}

function fromUnknown(e: unknown, table?: string): AuditFailure {
  if (e instanceof Error) return { message: e.message, table };
  return { message: String(e), table };
}

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

  const run = async (
    id: string,
    label: string,
    fn: () => Promise<{ detail: string } | { failure: AuditFailure }>,
  ) => {
    const t0 = performance.now();
    let outcome: { detail: string } | { failure: AuditFailure };
    try {
      outcome = await fn();
    } catch (e) {
      outcome = { failure: fromUnknown(e) };
    }
    const ms = Math.round(performance.now() - t0);
    if ("detail" in outcome) {
      results.push({ id, label, status: "pass", detail: outcome.detail, ms });
    } else {
      results.push({
        id,
        label,
        status: "fail",
        detail: outcome.failure.message,
        ms,
        failure: outcome.failure,
      });
    }
  };

  await run("auth", "Sign in as test account", async () => {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { failure: fromAuth(error) };
    if (!data.session) {
      return { failure: { message: "no session returned", operation: "auth" } };
    }
    return { detail: `uid ${data.user!.id.slice(0, 8)}…` };
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

  await run("profile", "Profile + organization linked", async () => {
    const { data, error } = await client
      .from("profiles")
      .select("organization_id, full_name")
      .maybeSingle();
    if (error) return { failure: fromPostgrest(error, "profiles", "select") };
    if (!data?.organization_id) {
      return {
        failure: {
          message: "no organization linked to this profile",
          table: "profiles",
          operation: "select",
          policyHint:
            "Profile row was not visible via RLS, or it exists but organization_id is null. Check the profiles SELECT policy and the handle_new_user trigger.",
        },
      };
    }
    return { detail: `org ${data.organization_id.slice(0, 8)}…` };
  });

  for (const probe of PROBES) {
    await run(probe.id, probe.label, async () => {
      // Cast: PROBES intentionally enumerates many tables, which overwhelms
      // the generated row-typing union otherwise.
      const { error, count } = await (client.from as unknown as (
        t: string,
      ) => {
        select: (
          c: string,
          o: { count: "exact"; head: true },
        ) => Promise<{ error: PostgrestError | null; count: number | null }>;
      })(probe.table).select("*", { count: "exact", head: true });
      if (error) {
        return { failure: fromPostgrest(error, probe.table as string, "select") };
      }
      return { detail: `${count ?? 0} row(s) visible via RLS` };
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
