import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/integrations/supabase/subscription-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { deliverOutreachEmail, loadOutreachDeliveryChannels } from "@/lib/email/outreach-delivery";
import { fetchOrgBranding } from "@/lib/org-branding";
import { z } from "zod";

/**
 * Bulk-approve & send AI follow-up suggestions from the inbox.
 *
 * For each suggestion id:
 *   - Loads the row + linked lead.
 *   - Sends the existing subject/message via the org's outreach delivery.
 *   - Marks the suggestion `sent` (or `failed` on dispatch error).
 *
 * Returns { sent, failed, errors } so the UI can show a single toast.
 */

const schema = z.object({
  organizationId: z.string().uuid(),
  suggestionIds: z.array(z.string().uuid()).min(1).max(50),
});

interface Result {
  sent: number;
  failed: number;
  errors: string[];
}

export const sendFollowupSuggestionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveSubscription])
  .inputValidator((input: z.infer<typeof schema>) => schema.parse(input))
  .handler(async ({ data, context }): Promise<Result> => {
    const { supabase, userId } = context;

    // Verify org membership
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();
    if (!profile || profile.organization_id !== data.organizationId) {
      throw new Error("Unauthorized: not a member of this organization");
    }

    const org = await fetchOrgBranding(supabase, data.organizationId);
    if (!org) throw new Error("Organization not found");

    const channels = await loadOutreachDeliveryChannels(data.organizationId);
    const businessReplyTo =
      (org.support_email && org.support_email.trim()) ||
      channels.sendgrid?.fromAddress ||
      channels.connectors[0]?.fromAddress ||
      null;

    // Load suggestions (RLS-respecting via the user's supabase client).
    const { data: suggestions, error: loadErr } = await supabase
      .from("lead_followup_suggestions")
      .select("id, lead_id, subject, message, status")
      .in("id", data.suggestionIds);
    if (loadErr) throw new Error(loadErr.message);

    const leadIds = Array.from(new Set((suggestions ?? []).map((s) => s.lead_id)));
    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, email")
      .in("id", leadIds);
    const leadById = new Map((leads ?? []).map((l) => [l.id, l]));

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const businessName = org.brand_name || org.name;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    for (const s of suggestions ?? []) {
      if (s.status === "sent") continue;
      const lead = leadById.get(s.lead_id);
      if (!lead?.email) {
        failed++;
        errors.push(`${lead?.name ?? "Unknown"}: no email on lead`);
        continue;
      }

      try {
        const subject = s.subject?.trim() || `Following up`;
        const dispatch = await deliverOutreachEmail({
          recipientEmail: lead.email,
          subject,
          body: s.message,
          brandName: businessName,
          replyTo: businessReplyTo ?? undefined,
          idempotencyKey: `followup-suggestion-${s.id}`,
          channels,
          organizationId: data.organizationId,
          logoUrl: org.logo_url ?? null,
          accentColor: org.primary_color ?? null,
          fontFamily: org.font_family ?? null,
          signature: org.email_signature ?? null,
        });

        if (!dispatch.success) {
          failed++;
          errors.push(`${lead.name}: ${dispatch.reason}`);
          await supabaseAdmin
            .from("lead_followup_suggestions")
            .update({
              status: "approved",
              reviewed_by: userId,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", s.id);
          continue;
        }

        await supabaseAdmin
          .from("lead_followup_suggestions")
          .update({
            status: "sent",
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
          })
          .eq("id", s.id);

        await supabaseAdmin
          .from("leads")
          .update({ status: "contacted", last_contact: new Date().toISOString() })
          .eq("id", lead.id)
          .eq("status", "new");

        sent++;
      } catch (err) {
        failed++;
        errors.push(`${lead.name}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
      await sleep(200);
    }

    return { sent, failed, errors: errors.slice(0, 10) };
  });
