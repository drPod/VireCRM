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
