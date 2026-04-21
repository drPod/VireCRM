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

    // Verify org membership — maybeSingle for graceful degradation
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile || profile.organization_id !== data.organizationId) {
      throw new Error("Unauthorized: not a member of this organization");
    }

    // Check AI token limits
    const { data: org } = await supabase
      .from("organizations")
      .select("ai_tokens_used, ai_tokens_limit, name")
      .eq("id", data.organizationId)
      .maybeSingle();

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

    // Try the primary model first; if it fails or returns no tool_calls, try a fallback.
    // Preview models occasionally drop tool-calls; stable models are more reliable.
    const MODELS = ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"];

    let aiData: unknown = null;
    let lastError: { status?: number; body?: string; reason?: string } | null = null;

    for (const model of MODELS) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `You are a B2B lead generation expert. Generate ${data.count} realistic potential lead contacts. ${industryHint} ${personaHint}

Each lead should be a realistic-sounding person at a company that would genuinely benefit from a B2B product or service. Make names, companies, emails, and roles diverse and realistic. Use realistic email formats (firstname@company.com). Vary the company sizes and lead quality scores.

Return ONLY valid JSON, no markdown.`,
            },
            { role: "user", content: userPrompt },
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
        const errBody = await aiResponse.text().catch(() => "");
        console.error(`find-leads gateway error (${model})`, aiResponse.status, errBody.slice(0, 300));
        lastError = { status: aiResponse.status, body: errBody };
        // Hard-stop on rate limit / billing — fallback won't help.
        if (aiResponse.status === 429) throw new Error("AI is rate-limited right now. Please wait ~30 seconds and try again.");
        if (aiResponse.status === 402) throw new Error("AI credits exhausted on this workspace. Please add funds.");
        // Other errors → try fallback model.
        continue;
      }

      const parsed = await aiResponse.json();
      const toolCall = parsed.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.warn(`find-leads (${model}): no tool_calls, trying fallback`);
        lastError = { reason: "no tool_calls returned" };
        continue;
      }
      aiData = parsed;
      break;
    }

    if (!aiData) {
      throw new Error(
        `AI lead generation failed after trying ${MODELS.length} model${MODELS.length > 1 ? "s" : ""}. ${
          lastError?.status ? `Last status: ${lastError.status}` : lastError?.reason ?? "Unknown reason"
        }. Please try again in a moment.`,
      );
    }

    const aiDataTyped = aiData as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> };
    const toolCallArgs = aiDataTyped.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!toolCallArgs) {
      throw new Error("AI returned an unexpected response shape. Please try again.");
    }

    let result: { leads?: SuggestedLead[] };
    try {
      result = JSON.parse(toolCallArgs);
    } catch {
      throw new Error("AI returned malformed JSON. Please try again.");
    }

    if (!Array.isArray(result.leads) || result.leads.length === 0) {
      throw new Error("AI returned an empty list. Try a more specific business description.");
    }

    // Increment token usage atomically
    await supabaseAdmin.rpc("increment_ai_tokens", { p_org_id: data.organizationId });

    return { leads: result.leads };
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
