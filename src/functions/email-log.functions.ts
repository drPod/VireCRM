import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export interface EmailLogEntry {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export const listRecentEmailLogsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailLogEntry[]> => {
    const { supabase, userId } = context;

    // Only org owners may view email audit logs (sensitive recipient data)
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) return [];

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", profile.organization_id)
      .eq("role", "owner")
      .maybeSingle();

    if (!roleRow) {
      throw new Response("Forbidden: owner role required", { status: 403 });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Response("Email log unavailable", { status: 500 });
    }

    const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Pull a generous window then dedupe by message_id (latest status wins)
    const { data, error } = await admin
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      throw new Response(`Failed to load email log: ${error.message}`, { status: 500 });
    }

    const seen = new Set<string>();
    const deduped: EmailLogEntry[] = [];
    for (const row of data ?? []) {
      const key = row.message_id ?? `__row:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row as EmailLogEntry);
      if (deduped.length >= 50) break;
    }

    return deduped;
  });

/**
 * Fetch email logs for a single recipient. Available to any authenticated org
 * member (not just owners) so reps can see send status on leads they manage.
 * Verifies the recipient email belongs to a lead inside their org.
 */
export const listLeadEmailLogsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): { email: string } => {
    if (!input || typeof input !== "object") throw new Error("Invalid input");
    const { email } = input as { email?: unknown };
    if (typeof email !== "string" || !email.trim()) throw new Error("email required");
    return { email: email.trim().toLowerCase() };
  })
  .handler(async ({ data, context }): Promise<EmailLogEntry[]> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) return [];

    // Verify this email belongs to a lead in the caller's org (RLS enforced).
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .ilike("email", data.email)
      .eq("organization_id", profile.organization_id)
      .limit(1)
      .maybeSingle();

    if (!lead) return [];

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [];

    const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error } = await admin
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .ilike("recipient_email", data.email)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return [];

    // Dedupe by message_id (most recent status wins)
    const seen = new Set<string>();
    const deduped: EmailLogEntry[] = [];
    for (const row of rows ?? []) {
      const key = row.message_id ?? `__row:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row as EmailLogEntry);
      if (deduped.length >= 50) break;
    }

    return deduped;
  });
