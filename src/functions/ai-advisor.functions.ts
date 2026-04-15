import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const analyzeSchema = z.object({
  businessDescription: z.string().min(10).max(5000),
  organizationId: z.string().uuid(),
});

export const analyzeBusinessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof analyzeSchema>) => analyzeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check org membership
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
      .select("ai_tokens_used, ai_tokens_limit, plan")
      .eq("id", data.organizationId)
      .single();

    if (!org) throw new Error("Organization not found");
    if (org.ai_tokens_used >= org.ai_tokens_limit) {
      throw new Error("AI token limit reached. Upgrade your plan for more analyses.");
    }

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

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
            content: `You are a strategic sales advisor AI. Analyze the business description and output a JSON object with exactly these fields:
{
  "icp": {
    "title": "Ideal Customer Profile title",
    "industry": "Target industry",
    "company_size": "e.g. 50-500 employees",
    "revenue_range": "e.g. $1M-$50M",
    "decision_maker": "e.g. VP of Sales",
    "pain_points": ["pain point 1", "pain point 2", "pain point 3"],
    "buying_signals": ["signal 1", "signal 2"]
  },
  "search_filters": {
    "industries": ["industry1", "industry2"],
    "job_titles": ["title1", "title2"],
    "company_size_min": 50,
    "company_size_max": 500,
    "revenue_min": "$1M",
    "revenue_max": "$50M",
    "keywords": ["keyword1", "keyword2"]
  },
  "strategic_hook": "A compelling 2-3 sentence outreach hook that would grab attention"
}
Return ONLY valid JSON, no markdown or explanation.`,
          },
          {
            role: "user",
            content: data.businessDescription,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_business",
              description: "Analyze a business and return ICP, search filters, and strategic hook",
              parameters: {
                type: "object",
                properties: {
                  icp: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      industry: { type: "string" },
                      company_size: { type: "string" },
                      revenue_range: { type: "string" },
                      decision_maker: { type: "string" },
                      pain_points: { type: "array", items: { type: "string" } },
                      buying_signals: { type: "array", items: { type: "string" } },
                    },
                    required: ["title", "industry", "company_size", "revenue_range", "decision_maker", "pain_points", "buying_signals"],
                  },
                  search_filters: {
                    type: "object",
                    properties: {
                      industries: { type: "array", items: { type: "string" } },
                      job_titles: { type: "array", items: { type: "string" } },
                      company_size_min: { type: "number" },
                      company_size_max: { type: "number" },
                      revenue_min: { type: "string" },
                      revenue_max: { type: "string" },
                      keywords: { type: "array", items: { type: "string" } },
                    },
                    required: ["industries", "job_titles", "keywords"],
                  },
                  strategic_hook: { type: "string" },
                },
                required: ["icp", "search_filters", "strategic_hook"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_business" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (aiResponse.status === 402) throw new Error("AI credits exhausted. Please add funds.");
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Save analysis to database (using admin approach via the authenticated client)
    await supabase.from("ai_analyses").insert({
      organization_id: data.organizationId,
      user_id: userId,
      business_description: data.businessDescription,
      icp: result.icp,
      search_filters: result.search_filters,
      strategic_hook: result.strategic_hook,
    });

    // Increment token usage (via RPC or direct update won't work due to RLS - use admin)
    // We'll handle this via a separate approach
    
    return {
      icp: result.icp,
      searchFilters: result.search_filters,
      strategicHook: result.strategic_hook,
    };
  });
