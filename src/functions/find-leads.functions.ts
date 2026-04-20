import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const findLeadsSchema = z.object({
  organizationId: z.string().uuid(),
  // Optional — if omitted we fall back to a generic B2B prompt so users can
  // discover leads in one click without filling anything in.
  businessDescription: z.string().max(5000).optional(),
  industry: z.string().min(1).max(200).optional(),
  persona: z.string().min(1).max(200).optional(),
  count: z.number().min(1).max(20).default(10),
});

export const findLeadsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof findLeadsSchema>) => findLeadsSchema.parse(input))
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

    // Check AI token limits
    const { data: org } = await supabase
      .from("organizations")
      .select("ai_tokens_used, ai_tokens_limit, name")
      .eq("id", data.organizationId)
      .single();

    if (!org) throw new Error("Organization not found");
    if (org.ai_tokens_used >= org.ai_tokens_limit) {
      throw new Error("AI token limit reached. Upgrade your plan for more analyses.");
    }

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    const industryHint = data.industry ? `The business is in the ${data.industry} industry.` : "";
    const personaHint = data.persona
      ? `Target persona: every lead MUST hold the role of "${data.persona}" (or a near-equivalent title) at their company.`
      : "";
    const description = data.businessDescription?.trim();
    const orgHint = org.name ? `The user's company is called "${org.name}".` : "";
    const userPrompt = description
      ? `Business: ${description}\n\nGenerate ${data.count} potential leads.`
      : `${orgHint} No business description was provided. Generate ${data.count} high-quality, diverse B2B leads (decision-makers at SMBs and mid-market companies across varied industries) that any growing business could plausibly sell to.`;

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
            content: `You are a B2B lead generation expert. Generate ${data.count} realistic potential lead contacts. ${industryHint} ${personaHint}

Each lead should be a realistic-sounding person at a company that would genuinely benefit from a B2B product or service. Make names, companies, emails, and roles diverse and realistic. Use realistic email formats (firstname@company.com). Vary the company sizes and lead quality scores.

Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_leads",
              description: "Generate a list of potential leads for the business",
              parameters: {
                type: "object",
                properties: {
                  leads: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Full name of the contact" },
                        email: { type: "string", description: "Professional email address" },
                        phone: { type: "string", description: "Phone number with country code" },
                        company: { type: "string", description: "Company name" },
                        role: { type: "string", description: "Job title/role" },
                        score: { type: "number", description: "Lead quality score 1-100" },
                        reason: { type: "string", description: "Why this is a good lead (1 sentence)" },
                      },
                      required: ["name", "email", "company", "role", "score", "reason"],
                    },
                  },
                },
                required: ["leads"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_leads" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (aiResponse.status === 402) throw new Error("AI credits exhausted. Please add funds.");
      throw new Error("AI lead generation failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Increment token usage atomically
    await supabaseAdmin.rpc("increment_ai_tokens", { p_org_id: data.organizationId });

    return { leads: result.leads as SuggestedLead[] };
  });

export interface SuggestedLead {
  name: string;
  email: string;
  phone?: string;
  company: string;
  role: string;
  score: number;
  reason: string;
}
