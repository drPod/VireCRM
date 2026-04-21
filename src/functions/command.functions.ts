import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

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
            content: `You are an AI CRM command interpreter. The user's CRM has ${leadCount ?? 0} leads and ${campaignCount ?? 0} campaigns.

Given a natural-language sales command, produce an execution plan. Return ONLY valid JSON using the analyze_command tool.

Be specific and actionable. Each step should be something a CRM automation could execute.`,
          },
          { role: "user", content: data.command },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_command",
              description: "Break a CRM command into an actionable execution plan",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "One-line summary of what will happen",
                  },
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
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_command" } },
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text().catch(() => "");
      console.error("command gateway error", aiResponse.status, errBody.slice(0, 300));
      if (aiResponse.status === 429) throw new Error("Rate limit reached. Please try again shortly.");
      if (aiResponse.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      throw new Error(`AI service error (${aiResponse.status})`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("command: no tool_calls", JSON.stringify(aiData).slice(0, 400));
      throw new Error("AI did not return a valid plan. Try rephrasing.");
    }

    const plan: CommandPlan = JSON.parse(toolCall.function.arguments);
    return plan;
  });
