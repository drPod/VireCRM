import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchOutreachEmail } from "@/lib/email/dispatch-outreach";
import type { Database } from "@/integrations/supabase/types";

/**
 * Send a queued test email through the standard Lovable email queue (the
 * exact same path that real outreach uses) and return the messageId so the
 * UI can poll for status (queued → sending → delivered/failed).
 */
const sendInputSchema = z.object({
  to: z.string().email().max(254),
});

export const sendQueuedTestEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof sendInputSchema>) => sendInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<
    | { ok: true; messageId: string; recipient: string }
    | { ok: false; error: string }
  > => {
    const { userId, supabase } = context;

    // Owner-only — same gate as the audit log
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return { ok: false, error: "No organization" };

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", profile.organization_id)
      .eq("role", "owner")
      .maybeSingle();
    if (!roleRow) return { ok: false, error: "Owner role required to send test emails." };

    const { data: org } = await supabase
      .from("organizations")
      .select("brand_name, name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    const brandName = org?.brand_name || org?.name || "Genesis";

    const idempotencyKey = `test-email-${userId}-${Date.now()}`;

    const result = await dispatchOutreachEmail({
      templateName: "outreach-email",
      recipientEmail: data.to,
      idempotencyKey,
      fromName: brandName,
      templateData: {
        subject: `Test email from ${brandName}`,
        body:
          "This is a deliverability test sent from your CRM.\n\n" +
          "If you received this message, your sending pipeline is healthy: " +
          "the message was queued, picked up by the dispatcher, and delivered.\n\n" +
          "You can safely ignore or delete this email.",
        brandName,
      },
    });

    if (!result.success) {
      return { ok: false, error: `${result.reason}${result.error ? `: ${result.error}` : ""}` };
    }

    return { ok: true, messageId: result.messageId, recipient: data.to };
  });

export interface TestEmailStatus {
  messageId: string;
  recipient: string;
  status: "queued" | "sending" | "delivered" | "failed" | "suppressed" | "unknown";
  rawStatus: string | null;
  errorMessage: string | null;
  lastUpdated: string | null;
}

const lookupSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1).max(20),
});

/**
 * Look up the latest status for a batch of test message IDs. Maps the
 * raw email_send_log status into the UI's lifecycle vocabulary.
 */
export const lookupTestEmailStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof lookupSchema>) => lookupSchema.parse(input))
  .handler(async ({ data, context }): Promise<TestEmailStatus[]> => {
    const { userId, supabase } = context;

    // Owner-only
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
    if (!roleRow) throw new Error("Forbidden: owner role required.");

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Backend missing credentials.");
    }

    const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error } = await admin
      .from("email_send_log")
      .select("message_id, recipient_email, status, error_message, created_at")
      .in("message_id", data.messageIds)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Latest row wins per message_id
    const latest = new Map<string, TestEmailStatus>();
    for (const row of rows ?? []) {
      if (!row.message_id) continue;
      if (latest.has(row.message_id)) continue;
      const raw = (row.status ?? "").toLowerCase();
      let status: TestEmailStatus["status"] = "unknown";
      if (raw === "pending") status = "queued";
      else if (raw === "sending") status = "sending";
      else if (raw === "sent" || raw === "delivered") status = "delivered";
      else if (raw === "suppressed") status = "suppressed";
      else if (
        raw === "failed" ||
        raw === "dlq" ||
        raw === "bounced" ||
        raw === "complained"
      )
        status = "failed";
      latest.set(row.message_id, {
        messageId: row.message_id,
        recipient: row.recipient_email,
        status,
        rawStatus: row.status,
        errorMessage: row.error_message,
        lastUpdated: row.created_at,
      });
    }

    // Fill in any messageIds we have no log row for yet (just enqueued)
    return data.messageIds.map(
      (id) =>
        latest.get(id) ?? {
          messageId: id,
          recipient: "",
          status: "queued" as const,
          rawStatus: null,
          errorMessage: null,
          lastUpdated: null,
        },
    );
  });
