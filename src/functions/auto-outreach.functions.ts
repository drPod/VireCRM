import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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

export const autoOutreachFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof outreachSchema>) => outreachSchema.parse(input))
  .handler(async ({ data, context }) => {
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

    // Get org info for context
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

    // Filter leads that have emails
    const leadsWithEmail = data.leads.filter((l) => l.email);
    if (leadsWithEmail.length === 0) {
      return { sent: 0, skipped: data.leads.length, messages: [] };
    }

    const businessName = org.brand_name || org.name;
    const businessCtx = data.businessContext
      ? `Business context: ${data.businessContext}`
      : `Business: ${businessName}`;

    const leadsInfo = leadsWithEmail.map((l) =>
      `- ${l.name}${l.company ? ` at ${l.company}` : ""}${l.role ? ` (${l.role})` : ""}${l.score ? ` [score: ${l.score}]` : ""}`
    ).join("\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
      if (aiResponse.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (aiResponse.status === 402) throw new Error("AI credits exhausted.");
      throw new Error("AI outreach generation failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    const result = JSON.parse(toolCall.function.arguments);
    const generatedEmails = result.emails as Array<{
      lead_name: string;
      subject: string;
      body: string;
    }>;

    // Match generated emails to leads and insert messages
    const messagesToInsert = generatedEmails
      .map((email) => {
        const lead = leadsWithEmail.find(
          (l) => l.name.toLowerCase() === email.lead_name.toLowerCase()
        );
        if (!lead) return null;
        return {
          organization_id: data.organizationId,
          lead_id: lead.id,
          subject: email.subject,
          content: email.body,
          type: "email" as const,
          status: "sent" as const,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    if (messagesToInsert.length > 0) {
      const { error } = await supabase.from("messages").insert(messagesToInsert);
      if (error) {
        console.error("Failed to save outreach messages:", error);
        throw new Error("Failed to save outreach messages");
      }

      // Update lead status to "contacted" and set last_contact
      const leadIds = messagesToInsert.map((m) => m!.lead_id!);
      await supabase
        .from("leads")
        .update({ status: "contacted", last_contact: new Date().toISOString() })
        .in("id", leadIds)
        .eq("status", "new"); // Only update leads still in "new" status
    }

    // Increment token usage atomically
    await supabaseAdmin.rpc("increment_ai_tokens", { p_org_id: data.organizationId });

    return {
      sent: messagesToInsert.length,
      skipped: data.leads.length - messagesToInsert.length,
      messages: generatedEmails,
    };
  });
