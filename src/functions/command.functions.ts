import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAiWithFallback, DEFAULT_TEXT_MODELS } from "@/lib/ai-gateway";
import { z } from "zod";

const commandSchema = z.object({
  command: z.string().min(1).max(500),
});

export interface CommandStep {
  step: number;
  action: string;
  detail: string;
  estimatedTime: string;
}

export interface CommandPlan {
  summary: string;
  steps: CommandStep[];
  estimatedTotal: string;
  warnings: string[];
}

export const executeCommandFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof commandSchema>) => commandSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get user's org for context (maybeSingle for graceful 0-row handling)
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      throw new Error("No organization found for user");
    }

    // Get lead/campaign counts for context
    const { count: leadCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id);

    const { count: campaignCount } = await supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id);

    const plan = await callAiWithFallback<CommandPlan>({
      featureLabel: "Command bar",
      models: DEFAULT_TEXT_MODELS,
      toolName: "analyze_command",
      toolDescription: "Break a CRM command into an actionable execution plan",
      systemPrompt: `You are an AI CRM command interpreter. The user's CRM has ${leadCount ?? 0} leads and ${campaignCount ?? 0} campaigns.

Given a natural-language sales command, produce an execution plan. Be specific and actionable. Each step should be something a CRM automation could execute.`,
      userPrompt: data.command,
      toolSchema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One-line summary of what will happen" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step: { type: "number" },
                action: { type: "string", description: "Short action name" },
                detail: { type: "string", description: "What this step does" },
                estimatedTime: { type: "string", description: "e.g. '2 min'" },
              },
              required: ["step", "action", "detail", "estimatedTime"],
            },
          },
          estimatedTotal: { type: "string", description: "Total estimated time" },
          warnings: {
            type: "array",
            items: { type: "string" },
            description: "Any risks or things to watch out for",
          },
        },
        required: ["summary", "steps", "estimatedTotal", "warnings"],
      },
    });

    return plan;
  });
