import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiWithFallback, DEFAULT_TEXT_MODELS } from "@/lib/ai-gateway";
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof outreachSchema>) => outreachSchema.parse(input))
  .handler(async ({ data, context }): Promise<OutreachResult> => {
    const { supabase, userId } = context;

    // Forward the caller's JWT to the internal /lovable/email/transactional/send
    // route — that route requires `Authorization: Bearer <user-jwt>` and we're
    // running server-side here so we have to re-attach it manually.
    const req = getRequest();
    const incomingAuth = req?.headers.get("authorization") ?? null;
    if (!incomingAuth) {
      throw new Error("Missing authorization header — cannot send emails");
    }
    // Server-side fetch needs an absolute URL — derive origin from the request.
    const origin = req ? new URL(req.url).origin : "";

    // Verify org membership
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (!profile || profile.organization_id !== data.organizationId) {
      throw new Error("Unauthorized: not a member of this organization");
    }

    // Get org info for context + token-budget enforcement
    const { data: org } = await supabase
      .from("organizations")
      .select("name, brand_name, ai_tokens_used, ai_tokens_limit")
      .eq("id", data.organizationId)
      .single();

    if (!org) throw new Error("Organization not found");
    if (org.ai_tokens_used >= org.ai_tokens_limit) {
      throw new Error("AI token limit reached. Upgrade your plan for more.");
    }

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

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
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional sales outreach copywriter for ${businessName}. Write personalized, concise cold outreach emails for each lead. Each email should:
- Be 3-5 sentences max
- Reference the lead's company/role if available
- Include a clear value proposition
- End with a soft call-to-action (e.g., "Would you be open to a quick chat?")
- Sound human and natural, NOT templated or salesy
- Use the lead's first name

Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `${businessCtx}\n\nGenerate personalized outreach emails for these leads:\n${leadsInfo}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_outreach",
              description: "Generate personalized outreach emails for leads",
              parameters: {
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
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_outreach" } },
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text().catch(() => "");
      console.error("auto-outreach gateway error", aiResponse.status, errBody.slice(0, 300));
      if (aiResponse.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (aiResponse.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      throw new Error(`AI outreach generation failed (${aiResponse.status})`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("auto-outreach: no tool_calls", JSON.stringify(aiData).slice(0, 400));
      throw new Error("AI did not return structured output. Try again.");
    }

    const result = JSON.parse(toolCall.function.arguments);
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

        // b) Hand off to the transactional email pipeline. We forward the
        // caller's JWT so the send route's auth check passes.
        const sendRes = await fetch(`${origin}/lovable/email/transactional/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: incomingAuth,
          },
          body: JSON.stringify({
            templateName: "outreach-email",
            recipientEmail: lead.email,
            // Idempotency key so a retry of this server fn won't duplicate-send.
            idempotencyKey: `outreach-${inserted.id}`,
            templateData: {
              subject: email.subject,
              body: email.body,
              brandName: businessName,
            },
            fromName: businessName,
          }),
        });

        if (!sendRes.ok) {
          const detail = await sendRes.text().catch(() => "");
          throw new Error(`Email pipeline rejected (${sendRes.status}): ${detail.slice(0, 120)}`);
        }

        const sendBody = (await sendRes.json().catch(() => ({}))) as {
          success?: boolean;
          reason?: string;
        };

        if (sendBody.success === false) {
          // e.g. recipient is on the suppression list — that's expected, not a crash.
          await supabase
            .from("messages")
            .update({ status: "suppressed" })
            .eq("id", inserted.id);
          skipped++;
          errors.push(`${lead.name}: ${sendBody.reason || "suppressed"}`);
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
