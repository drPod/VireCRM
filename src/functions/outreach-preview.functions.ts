import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/integrations/supabase/subscription-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiWithFallback, DEFAULT_TEXT_MODELS } from "@/lib/ai-gateway";
import {
  deliverOutreachEmail,
  loadOutreachDeliveryChannels,
} from "@/lib/email/outreach-delivery";
import { z } from "zod";

// =============================================================================
// previewOutreachFn — generate AI subject/body for ONE lead, no DB writes, no send.
// Used by the drawer's "Send outreach" button to show a preview dialog the user
// can edit before committing. Billed as one AI token (same as a real send).
// =============================================================================

const previewSchema = z.object({
  organizationId: z.string().uuid(),
  lead: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    email: z.string().email(),
    company: z.string().max(200).optional().nullable(),
    role: z.string().max(200).optional().nullable(),
    score: z.number().min(0).max(100).optional().nullable(),
  }),
  businessContext: z.string().min(1).max(5000).optional(),
});

export interface OutreachPreview {
  subject: string;
  body: string;
}

export const previewOutreachFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveSubscription])
  .inputValidator((input: z.infer<typeof previewSchema>) => previewSchema.parse(input))
  .handler(async ({ data, context }): Promise<OutreachPreview> => {
    const { supabase, userId } = context;

    // Org membership + token-budget check (same rules as real send).
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile || profile.organization_id !== data.organizationId) {
      throw new Error("Unauthorized: not a member of this organization");
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name, brand_name, ai_tokens_used, ai_tokens_limit")
      .eq("id", data.organizationId)
      .maybeSingle();

    if (!org) throw new Error("Organization not found");
    if (org.ai_tokens_used >= org.ai_tokens_limit) {
      throw new Error("AI token limit reached. Upgrade your plan for more.");
    }

    const businessName = org.brand_name || org.name;
    const businessCtx = data.businessContext
      ? `Business context: ${data.businessContext}`
      : `Business: ${businessName}`;

    const lead = data.lead;
    const leadInfo = `${lead.name}${lead.company ? ` at ${lead.company}` : ""}${lead.role ? ` (${lead.role})` : ""}${lead.score ? ` [score: ${lead.score}]` : ""}`;

    const result = await callAiWithFallback<{ subject?: string; body?: string }>({
      featureLabel: "Outreach preview",
      models: DEFAULT_TEXT_MODELS,
      organizationId: profile.organization_id,
      userId,
      toolName: "generate_outreach",
      toolDescription: "Generate a personalized outreach email",
      systemPrompt: `You are a professional sales outreach copywriter for ${businessName}. Write a personalized, concise cold outreach email. The email should:
- Be 3-5 sentences max
- Reference the lead's company/role if available
- Include a clear value proposition
- End with a soft call-to-action (e.g., "Would you be open to a quick chat?")
- Sound human and natural, NOT templated or salesy
- Use the lead's first name`,
      userPrompt: `${businessCtx}\n\nGenerate a personalized outreach email for this lead:\n- ${leadInfo}`,
      toolSchema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Email subject line, max 60 chars" },
          body: { type: "string", description: "Email body text" },
        },
        required: ["subject", "body"],
      },
    });

    if (!result.subject || !result.body) {
      throw new Error("AI returned an incomplete email");
    }

    // Bill the generation. Sending later is free of additional AI cost.
    await supabaseAdmin.rpc("increment_ai_tokens", { p_org_id: data.organizationId });

    return { subject: result.subject, body: result.body };
  });

// =============================================================================
// sendOutreachWithContentFn — persist + send a user-approved email for ONE lead.
// No AI involved. Mirrors the per-lead delivery path of autoOutreachFn.
// =============================================================================

const sendSchema = z.object({
  organizationId: z.string().uuid(),
  leadId: z.string().uuid(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
});

export interface SendOutreachResult {
  success: boolean;
  reason?: string;
}

export const sendOutreachWithContentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveSubscription])
  .inputValidator((input: z.infer<typeof sendSchema>) => sendSchema.parse(input))
  .handler(async ({ data, context }): Promise<SendOutreachResult> => {
    const { supabase, userId } = context;

    // Org membership check
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile || profile.organization_id !== data.organizationId) {
      throw new Error("Unauthorized: not a member of this organization");
    }

    // Confirm lead belongs to this org (defense in depth — RLS already enforces it)
    const { data: lead } = await supabase
      .from("leads")
      .select("id, name, organization_id")
      .eq("id", data.leadId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();

    if (!lead) throw new Error("Lead not found");

    // Pull org branding + reply-to (business inbox) in one shot.
    const { data: org } = await supabase
      .from("organizations")
      .select("name, brand_name, support_email")
      .eq("id", data.organizationId)
      .maybeSingle();

    if (!org) throw new Error("Organization not found");
    const businessName = org.brand_name || org.name;
    const replyTo = org.support_email?.trim() || null;

    // 1. Persist the message row first (so we always have an audit trail
    // even if the send fails).
    const { data: inserted, error: insertErr } = await supabase
      .from("messages")
      .insert({
        organization_id: data.organizationId,
        lead_id: lead.id,
        subject: data.subject,
        content: data.body,
        type: "email",
        status: "draft",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      throw new Error(insertErr?.message || "Failed to save message");
    }

    const channels = await loadOutreachDeliveryChannels(data.organizationId);

    // 2. Deliver using the best available channel in priority order:
    // SendGrid → Gmail → Outlook → built-in queue-backed email.
    const result = await deliverOutreachEmail({
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      body: data.body,
      brandName: businessName,
      replyTo,
      idempotencyKey: `outreach-${inserted.id}`,
      channels,
    });

    if (!result.success) {
      await supabase
        .from("messages")
        .update({ status: result.suppressed ? "bounced" : "failed" })
        .eq("id", inserted.id);
      return {
        success: false,
        reason: result.reason,
      };
    }

    // 3. Mark sent + advance lead to "contacted" if still new.
    await supabase
      .from("messages")
      .update({ status: "sent" })
      .eq("id", inserted.id);

    await supabase
      .from("leads")
      .update({ status: "contacted", last_contact: new Date().toISOString() })
      .eq("id", lead.id)
      .eq("status", "new");

    return { success: true };
  });
