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

const outreachSchema = z.object({
  organizationId: z.string().uuid(),
  leads: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    email: z.string().email().optional(),
    company: z.string().max(200).optional(),
    role: z.string().max(200).optional(),
    score: z.number().min(0).max(100).optional(),
  })).min(1).max(50),
  businessContext: z.string().min(1).max(5000).optional(),
});

interface GeneratedEmail {
  lead_name: string;
  subject: string;
  body: string;
}

interface OutreachResult {
  /** Emails actually accepted by the email queue. */
  sent: number;
  /** Leads we couldn't email (no address, AI didn't return one for them, send failed). */
  skipped: number;
  /** Per-lead failure reasons — useful for the UI toast. */
  errors: string[];
  messages: GeneratedEmail[];
}

/** Tiny helper so one bad send doesn't block the loop. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const autoOutreachFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveSubscription])
  .inputValidator((input: z.infer<typeof outreachSchema>) => outreachSchema.parse(input))
  .handler(async ({ data, context }): Promise<OutreachResult> => {
    const { supabase, userId } = context;

    // Outreach delivery now happens entirely in-process (see
    // dispatchOutreachEmail). We no longer call our own public send route via
    // fetch, so there's no JWT to forward and no origin to derive.

    // Verify org membership
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (!profile || profile.organization_id !== data.organizationId) {
      throw new Error("Unauthorized: not a member of this organization");
    }

    // Get org info for context + token-budget enforcement.
    // `support_email` doubles as the org's business reply-to address — when
    // set, recipient replies route to the user's inbox instead of disappearing
    // into the platform default.
    const { data: org } = await supabase
      .from("organizations")
      .select("name, brand_name, support_email, ai_tokens_used, ai_tokens_limit")
      .eq("id", data.organizationId)
      .single();

    if (!org) throw new Error("Organization not found");
    if (org.ai_tokens_used >= org.ai_tokens_limit) {
      throw new Error("AI token limit reached. Upgrade your plan for more.");
    }

    if (!process.env.LOVABLE_API_KEY) throw new Error("AI service not configured");

    const deliveryChannels = await loadOutreachDeliveryChannels(data.organizationId);
    const businessReplyTo =
      (org.support_email && org.support_email.trim()) ||
      deliveryChannels.sendgrid?.fromAddress ||
      deliveryChannels.connectors[0]?.fromAddress ||
      null;

    // Filter leads that have emails — no email = no outreach.
    const leadsWithEmail = data.leads.filter((l) => l.email);
    const noEmailCount = data.leads.length - leadsWithEmail.length;
    if (leadsWithEmail.length === 0) {
      return {
        sent: 0,
        skipped: data.leads.length,
        errors: noEmailCount > 0 ? [`${noEmailCount} lead(s) had no email address`] : [],
        messages: [],
      };
    }

    const businessName = org.brand_name || org.name;
    const businessCtx = data.businessContext
      ? `Business context: ${data.businessContext}`
      : `Business: ${businessName}`;

    const leadsInfo = leadsWithEmail.map((l) =>
      `- ${l.name}${l.company ? ` at ${l.company}` : ""}${l.role ? ` (${l.role})` : ""}${l.score ? ` [score: ${l.score}]` : ""}`
    ).join("\n");

    // ----- 1. Generate copy in one AI call (cheaper + more consistent voice) -----
    const result = await callAiWithFallback<{ emails?: GeneratedEmail[] }>({
      featureLabel: "Auto-outreach",
      models: DEFAULT_TEXT_MODELS,
      organizationId: profile.organization_id,
      userId,
      toolName: "generate_outreach",
      toolDescription: "Generate personalized outreach emails for leads",
      systemPrompt: `You are a professional sales outreach copywriter for ${businessName}. Write personalized, concise cold outreach emails for each lead. Each email should:
- Be 3-5 sentences max
- Reference the lead's company/role if available
- Include a clear value proposition
- End with a soft call-to-action (e.g., "Would you be open to a quick chat?")
- Sound human and natural, NOT templated or salesy
- Use the lead's first name`,
      userPrompt: `${businessCtx}\n\nGenerate personalized outreach emails for these leads:\n${leadsInfo}`,
      toolSchema: {
        type: "object",
        properties: {
          emails: {
            type: "array",
            items: {
              type: "object",
              properties: {
                lead_name: { type: "string" },
                subject: { type: "string", description: "Email subject line, max 60 chars" },
                body: { type: "string", description: "Email body text" },
              },
              required: ["lead_name", "subject", "body"],
            },
          },
        },
        required: ["emails"],
      },
    });

    const generatedEmails = (result.emails ?? []) as GeneratedEmail[];

    // ----- 2. Per-lead: insert message row + dispatch email + update lead.
    // Each iteration is wrapped in its own try/catch so a single bad row
    // (RLS reject, suppressed recipient, transient 5xx) cannot kill the run.
    let sent = 0;
    let skipped = noEmailCount;
    const errors: string[] = [];
    const SEND_DELAY_MS = 250; // smooth out bursts; queue handles real rate limits

    for (const email of generatedEmails) {
      const lead = leadsWithEmail.find(
        (l) => l.name.toLowerCase() === email.lead_name.toLowerCase()
      );
      if (!lead || !lead.email) {
        skipped++;
        continue;
      }

      try {
        // a) Persist the message record (status: pending until queue accepts)
        const { data: inserted, error: insertErr } = await supabase
          .from("messages")
          .insert({
            organization_id: data.organizationId,
            lead_id: lead.id,
            subject: email.subject,
            content: email.body,
            type: "email",
            status: "draft",
          })
          .select("id")
          .single();

        if (insertErr || !inserted) {
          throw new Error(insertErr?.message || "Failed to save message");
        }

        const dispatch = await deliverOutreachEmail({
          recipientEmail: lead.email,
          subject: email.subject,
          body: email.body,
          brandName: businessName,
          replyTo: businessReplyTo ?? undefined,
          idempotencyKey: `outreach-${inserted.id}`,
          channels: deliveryChannels,
        });

        if (!dispatch.success) {
          await supabase
            .from("messages")
            .update({
              status: dispatch.suppressed ? "suppressed" : "failed",
            })
            .eq("id", inserted.id);
          skipped++;
          errors.push(`${lead.name}: ${dispatch.reason}`);
          continue;
        }

        // c) Mark message sent + advance lead to "contacted" if still new.
        await supabase
          .from("messages")
          .update({ status: "sent" })
          .eq("id", inserted.id);

        await supabase
          .from("leads")
          .update({ status: "contacted", last_contact: new Date().toISOString() })
          .eq("id", lead.id)
          .eq("status", "new");

        sent++;
      } catch (err) {
        skipped++;
        const message = err instanceof Error ? err.message : "unknown error";
        errors.push(`${lead.name}: ${message}`);
        console.error(`[auto-outreach] send failed for ${lead.name}:`, err);
      }

      await sleep(SEND_DELAY_MS);
    }

    // ----- 3. Bill the AI generation once, regardless of per-lead delivery outcome.
    await supabaseAdmin.rpc("increment_ai_tokens", { p_org_id: data.organizationId });

    return {
      sent,
      skipped,
      errors: errors.slice(0, 10), // cap so toast doesn't explode
      messages: generatedEmails,
    };
  });
