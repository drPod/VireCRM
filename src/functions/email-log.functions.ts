import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/auth/server";
import type { Database } from "@/integrations/supabase/types";

export interface EmailLogEntry {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
  subject: string | null;
  body_preview: string | null;
}

// Pull subject + preview out of the metadata jsonb. Both fields may live on
// different rows for the same message_id (pending vs sent), so callers should
// merge across rows when deduping.
function extractMeta(metadata: unknown): { subject: string | null; body_preview: string | null } {
  if (!metadata || typeof metadata !== "object") return { subject: null, body_preview: null };
  const m = metadata as Record<string, unknown>;
  const subject = typeof m.subject === "string" && m.subject.trim() ? m.subject : null;
  const body_preview =
    typeof m.body_preview === "string" && m.body_preview.trim() ? m.body_preview : null;
  return { subject, body_preview };
}

export const listRecentEmailLogsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
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
      // Throw a plain Error rather than a Response — TanStack server functions
      // serialize Error.message into a friendly client-side error, while a raw
      // Response surfaces as the dreaded "[object Response]" string.
      setResponseStatus(403);
      throw new Error("Forbidden: owner role required to view email logs.");
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Email log unavailable: backend is missing credentials.");
    }

    const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Pull a generous window then dedupe by message_id (latest status wins,
    // but pull subject/preview from any row in the same message_id group).
    const { data, error } = await admin
      .from("email_send_log")
      .select(
        "id, message_id, template_name, recipient_email, status, error_message, created_at, metadata",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(`Failed to load email log: ${error.message}`);
    }

    const byKey = new Map<string, EmailLogEntry>();
    const order: string[] = [];
    for (const row of data ?? []) {
      const key = row.message_id ?? `__row:${row.id}`;
      const meta = extractMeta((row as { metadata?: unknown }).metadata);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          id: row.id,
          message_id: row.message_id,
          template_name: row.template_name,
          recipient_email: row.recipient_email,
          status: row.status,
          error_message: row.error_message,
          created_at: row.created_at,
          subject: meta.subject,
          body_preview: meta.body_preview,
        });
        order.push(key);
      } else {
        if (!existing.subject && meta.subject) existing.subject = meta.subject;
        if (!existing.body_preview && meta.body_preview) existing.body_preview = meta.body_preview;
      }
    }

    return order.slice(0, 50).map((k) => byKey.get(k)!);
  });

/**
 * Fetch email logs for a single recipient. Available to any authenticated org
 * member (not just owners) so reps can see send status on leads they manage.
 * Verifies the recipient email belongs to a lead inside their org.
 */
export const listLeadEmailLogsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown): { email: string } => {
    if (!input || typeof input !== "object") throw new Error("Invalid input");
    const { email } = input as { email?: unknown };
    if (typeof email !== "string" || !email.trim()) throw new Error("email required");
    return { email: email.trim().toLowerCase() };
  })
  .handler(async ({ data, context }): Promise<EmailLogEntry[]> => {
    try {
      const { supabase, userId } = context;

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileErr) {
        console.error("[listLeadEmailLogsFn] profile lookup failed:", profileErr.message);
        return [];
      }
      if (!profile) return [];

      // Verify this email belongs to a lead in the caller's org (RLS enforced).
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .select("id")
        .ilike("email", data.email)
        .eq("organization_id", profile.organization_id)
        .limit(1)
        .maybeSingle();

      if (leadErr) {
        console.error("[listLeadEmailLogsFn] lead lookup failed:", leadErr.message);
        return [];
      }
      if (!lead) return [];

      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error("[listLeadEmailLogsFn] missing service role env");
        return [];
      }

      const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: rows, error } = await admin
        .from("email_send_log")
        .select(
          "id, message_id, template_name, recipient_email, status, error_message, created_at, metadata",
        )
        .ilike("recipient_email", data.email)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("[listLeadEmailLogsFn] email_send_log query failed:", error.message);
        return [];
      }

      const byKey = new Map<string, EmailLogEntry>();
      const order: string[] = [];
      for (const row of rows ?? []) {
        const key = row.message_id ?? `__row:${row.id}`;
        const meta = extractMeta((row as { metadata?: unknown }).metadata);
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, {
            id: row.id,
            message_id: row.message_id,
            template_name: row.template_name,
            recipient_email: row.recipient_email,
            status: row.status,
            error_message: row.error_message,
            created_at: row.created_at,
            subject: meta.subject,
            body_preview: meta.body_preview,
          });
          order.push(key);
        } else {
          if (!existing.subject && meta.subject) existing.subject = meta.subject;
          if (!existing.body_preview && meta.body_preview)
            existing.body_preview = meta.body_preview;
        }
      }

      return order.slice(0, 50).map((k) => byKey.get(k)!);
    } catch (err) {
      console.error(
        "[listLeadEmailLogsFn] unexpected error:",
        err instanceof Error ? err.message : err,
      );
      return [];
    }
  });
