import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { callAiWithFallback, DEFAULT_TEXT_MODELS } from "@/lib/ai-gateway";
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

    // Check org membership — use maybeSingle so 0 rows returns null instead of
    // throwing a PostgrestError that surfaces as "[object Object]" in the UI.
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
      .select("ai_tokens_used, ai_tokens_limit, plan")
      .eq("id", data.organizationId)
      .maybeSingle();

    if (!org) throw new Error("Organization not found");
    if (org.ai_tokens_used >= org.ai_tokens_limit) {
      throw new Error("AI token limit reached. Upgrade your plan for more analyses.");
    }

    interface AdvisorIcp {
      title: string;
      industry: string;
      company_size: string;
      revenue_range: string;
      decision_maker: string;
      pain_points: string[];
      buying_signals: string[];
    }
    interface AdvisorSearchFilters {
      industries: string[];
      job_titles: string[];
      company_size_min?: number;
      company_size_max?: number;
      revenue_min?: string;
      revenue_max?: string;
      keywords: string[];
    }

    const result = await callAiWithFallback<{
      icp: AdvisorIcp;
      search_filters: AdvisorSearchFilters;
      strategic_hook: string;
    }>({
      featureLabel: "AI advisor",
      models: DEFAULT_TEXT_MODELS,
      organizationId: data.organizationId,
      userId,
      toolName: "analyze_business",
      toolDescription: "Analyze a business and return ICP, search filters, and strategic hook",
      systemPrompt: `You are a strategic sales advisor AI. Analyze the business description and produce an Ideal Customer Profile, search filters, and a compelling 2-3 sentence outreach hook. Return ONLY structured output via the provided tool.`,
      userPrompt: data.businessDescription,
      toolSchema: {
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
            required: [
              "title",
              "industry",
              "company_size",
              "revenue_range",
              "decision_maker",
              "pain_points",
              "buying_signals",
            ],
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
    });

    // Save analysis to database. Cast to Json for the structured columns —
    // our typed AdvisorIcp / AdvisorSearchFilters are JSON-compatible.
    await supabase.from("ai_analyses").insert({
      organization_id: data.organizationId,
      user_id: userId,
      business_description: data.businessDescription,
      icp: result.icp as unknown as Json,
      search_filters: result.search_filters as unknown as Json,
      strategic_hook: result.strategic_hook,
    });

    // Increment token usage atomically via admin client
    await supabaseAdmin.rpc("increment_ai_tokens", { p_org_id: data.organizationId });

    return {
      icp: result.icp,
      searchFilters: result.search_filters,
      strategicHook: result.strategic_hook,
    };
  });
