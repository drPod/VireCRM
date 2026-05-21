import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/auth/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiWithFallback, DEFAULT_TEXT_MODELS } from "@/lib/ai-gateway";
import { logAdvisorExecution } from "@/lib/advisor-audit";
import {
  runAdvisorActions,
  type AgentAction,
  type AgentPlan,
  type ExecutionResult,
} from "@/lib/advisor/execute-actions";
import { z } from "zod";

/**
 * Execute the user's command by running the AI as an "agent" that picks
 * concrete actions to perform on their CRM. The action loop itself lives in
 * `@/lib/advisor/execute-actions` so it can be reused by the replay flow.
 */

const executeSchema = z.object({
  command: z.string().min(1).max(500),
});

const replaySchema = z.object({
  audit_id: z.string().uuid(),
});

// Re-export for consumers that import from this module.
export type { ExecutionResult } from "@/lib/advisor/execute-actions";

export interface ExecuteCommandResponse {
  summary: string;
  results: ExecutionResult[];
  /** Set when this run was triggered by a replay (id of the new audit row). */
  replay_of?: string;
}

// ---------- Server function: AI plan + execute ----------

export const executeCommandActionsFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof executeSchema>) => executeSchema.parse(input))
  .handler(async ({ data, context }): Promise<ExecuteCommandResponse> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) throw new Error("No organization found for user");
    const orgId = profile.organization_id;
    const startedAt = Date.now();
    const commandId = `cmd-${orgId}-${startedAt}`;

    // ----- Pre-flight credit: 1 credit for the AI planning call.
    // Unlimited tier bypasses this in the RPC.
    const planCredit = await supabaseAdmin.rpc("consume_credit", {
      p_org_id: orgId,
      p_count: 1,
      p_user_id: userId,
      p_action: "command_ai_plan",
      p_command_id: commandId,
      p_metadata: { command: data.command.slice(0, 200) },
    });
    const planCreditPayload = (planCredit.data ?? {}) as Record<string, unknown>;
    if (planCredit.error || planCreditPayload.ok === false) {
      const exhausted = planCreditPayload.error === "credits_exhausted";
      const blocked: ExecuteCommandResponse = {
        summary: exhausted
          ? "You're out of credits — top up in Settings → Billing to run AI commands."
          : "Could not verify your credit balance. Please try again.",
        results: [
          {
            type: "note",
            status: "skipped",
            handler: "in_app",
            message: exhausted
              ? "AI Command Center needs at least 1 credit to plan a response."
              : "Credit check failed before the AI plan ran.",
          },
        ],
      };
      await logAdvisorExecution({
        supabase: supabaseAdmin,
        organizationId: orgId,
        userId,
        command: data.command,
        summary: blocked.summary,
        plan: { blocked_by: "credits" } as unknown,
        results: blocked.results,
        durationMs: Date.now() - startedAt,
        errorMessage: exhausted ? "credits_exhausted" : "credit_check_failed",
      });
      return blocked;
    }

    const [{ count: leadCount }, { count: campaignCount }, { data: recentLeads }] =
      await Promise.all([
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId),
        supabase
          .from("campaigns")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId),
        supabase
          .from("leads")
          .select("id, name, company, status, score, last_contact")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false })
          .limit(15),
      ]);

    const leadContext = (recentLeads ?? [])
      .map(
        (l) =>
          `- ${l.name}${l.company ? ` @ ${l.company}` : ""} [status=${l.status}, score=${l.score ?? "?"}]`,
      )
      .join("\n");

    const plan = await callAiWithFallback<AgentPlan>({
      featureLabel: "Command executor",
      models: DEFAULT_TEXT_MODELS,
      organizationId: orgId,
      userId,
      toolName: "execute_crm_actions",
      toolDescription:
        "Translate the user's CRM command into a sequence of concrete actions to apply to their database.",
      systemPrompt: `You are a CRM execution agent. The org has ${leadCount ?? 0} leads and ${campaignCount ?? 0} campaigns.

Recent leads:
${leadContext || "(none yet)"}

You can ONLY produce these action types:
- create_lead: add a brand-new lead to the CRM. Use for "add a lead named X at company Y", "create a contact for jane@acme.com". Requires name; email/company/phone/source/status optional.
- create_task: schedule a generic to-do for the user. Use for "remind me", "todo".
- schedule_follow_up: schedule a dated follow-up tied to a specific lead. Use for "follow up with X in 3 days", "check back next week with Y". Requires lead_match and in_days.
- draft_message: write a personalized outreach draft saved to Messages as a DRAFT (NOT sent). Use for "write an email to ...", "draft a follow-up", "generate outreach for ...".
- log_message: record an already-occurred conversation (logged call, sent email, inbound reply) onto a lead's history. Use for "log that I called X yesterday", "log inbound reply from Y". Stored as status="logged" so it's not confused with drafts.
- update_lead_status: move a lead through the pipeline (new → contacted → qualified → negotiation → won/lost). Use for "mark X as qualified", "move Y to negotiation".
- score_leads: bulk-adjust scores on leads matching simple criteria. Use for "score my hot leads", "deprioritize cold leads".
- create_campaign: create a new campaign shell. Use for "start a campaign for ...".
- pipeline_summary: produce a written summary of pipeline health (no DB writes — the server fills the data).
- note: a plain explanation, used when no real action fits or to clarify what you skipped.

GUARDRAILS — you must obey:
- You operate ONLY on existing CRM data plus manual lead entry the user explicitly dictates. You CANNOT contact leads, send emails/SMS, dial phones, post to social, or trigger any external integration. Email "drafts" are saved to the Messages table for the user to review and send manually. log_message is for recording activity that already happened — it does not contact anyone.
- create_lead is for manual data entry only (the user gave you the name/email). You CANNOT scrape, enrich, or fetch leads from any external source (Apollo, LinkedIn, Hunter, Snov, web scraping, etc.). If the user asks to "find", "import", "enrich", "scrape", or "auto-source" leads in bulk, return a single 'note' action explaining that bulk lead sourcing is handled in the AI Advisor / Auto-Find Leads flow.
- Never produce action types outside the allowed list above. Anything outside this list will be discarded by the server.
- Pick the smallest set of actions that fulfils the command. Usually 1–3 actions.
- For draft_message, log_message, schedule_follow_up, and update_lead_status, set lead_match to the lead name/company the user mentioned.
- Never invent integrations, never claim emails were sent — drafts are saved for the user to send manually.
- Keep messages concise, professional, no placeholders like [Name].`,
      userPrompt: data.command,
      toolSchema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One sentence telling the user what you did." },
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "create_task",
                    "draft_message",
                    "score_leads",
                    "create_campaign",
                    "pipeline_summary",
                    "note",
                    "update_lead_status",
                    "log_message",
                    "schedule_follow_up",
                    "create_lead",
                  ],
                },
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                due_in_days: { type: "number" },
                lead_match: { type: "string" },
                subject: { type: "string" },
                body: { type: "string" },
                criteria: { type: "string" },
                score_delta: { type: "number" },
                status_filter: { type: "string" },
                max_leads: { type: "number" },
                name: { type: "string" },
                objective: { type: "string" },
                message: { type: "string" },
                new_status: {
                  type: "string",
                  enum: ["new", "contacted", "qualified", "negotiation", "won", "lost"],
                },
                reason: { type: "string" },
                channel: {
                  type: "string",
                  enum: ["email", "sms", "call", "note", "meeting", "task"],
                },
                direction: { type: "string", enum: ["outbound", "inbound"] },
                in_days: { type: "number" },
                notes: { type: "string" },
                company: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                source: { type: "string" },
                status: {
                  type: "string",
                  enum: ["new", "contacted", "qualified", "negotiation", "won", "lost"],
                },
              },
              required: ["type"],
            },
          },
        },
        required: ["summary", "actions"],
      },
    });

    // ---------- Intent guardrail (only meaningful for free-form commands) ----------
    const FORBIDDEN_INTENT = [
      /\b(send|email|sms|text|call|dial|message)\s+(the\s+)?(lead|leads|client|prospects?)\b/i,
      /\b(blast|broadcast|reach\s*out|cold[-\s]?email|cold[-\s]?call)\b/i,
      /\b(import|scrape|enrich|find|source|auto[-\s]?find|pull|fetch|search\s+for|look\s+up)\s+(new\s+)?(leads?|prospects?|companies|contacts?)\b/i,
      /\bapollo|linkedin\s+sales\s+nav|hunter\.io|snov\.io|zoominfo\b/i,
    ];
    const blockedByIntent = FORBIDDEN_INTENT.find((re) => re.test(data.command));
    if (blockedByIntent) {
      const blockedResponse: ExecuteCommandResponse = {
        summary:
          "Blocked: the Advisor can't contact leads or import new ones. Use Auto Outreach to send messages or AI Advisor → Find Leads to source new contacts.",
        results: [
          {
            type: "note",
            status: "skipped",
            handler: "in_app",
            message:
              "Guardrail: this command requires contacting leads or importing new ones, which is outside the Advisor's allowed scope. Try a follow-up task, lead scoring, a campaign shell, or a draft you can review and send manually.",
          },
        ],
      };
      await logAdvisorExecution({
        supabase: supabaseAdmin,
        organizationId: orgId,
        userId,
        command: data.command,
        summary: blockedResponse.summary,
        plan: { blocked_by: String(blockedByIntent) } as unknown,
        results: blockedResponse.results,
        durationMs: Date.now() - startedAt,
        errorMessage: "blocked_by_guardrail",
      });
      return blockedResponse;
    }

    const { sanitizedActions, results } = await runAdvisorActions({
      supabase,
      organizationId: orgId,
      userId,
      command: data.command,
      actions: plan.actions ?? [],
      chargeCredit: async (action) => {
        const charge = await supabaseAdmin.rpc("consume_credit", {
          p_org_id: orgId,
          p_count: 1,
          p_user_id: userId,
          p_action: `cmd_${action.type}`,
          p_command_id: commandId,
          p_metadata: { command: data.command.slice(0, 200) },
        });
        const payload = (charge.data ?? {}) as Record<string, unknown>;
        if (charge.error || payload.ok === false) {
          return {
            ok: false,
            reason:
              payload.error === "credits_exhausted"
                ? "Skipped — credits exhausted. Top up in Settings → Billing."
                : "Skipped — credit charge failed.",
          };
        }
        return { ok: true };
      },
    });
    plan.actions = sanitizedActions;

    const response: ExecuteCommandResponse = {
      summary: plan.summary || "Done.",
      results,
    };

    await logAdvisorExecution({
      supabase: supabaseAdmin,
      organizationId: orgId,
      userId,
      command: data.command,
      summary: response.summary,
      plan: plan as unknown,
      results,
      durationMs: Date.now() - startedAt,
    });

    return response;
  });

// ---------- Server function: replay a saved plan ----------

/**
 * Re-run the saved JSON plan from a previous audit entry. Skips the AI
 * planning step but reuses the exact same guardrails (allowlist, n8n
 * routing, in-app handlers) and writes a brand-new audit row so each
 * replay has a fresh execution ID and timestamp.
 */
export const replayCommandPlanFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof replaySchema>) => replaySchema.parse(input))
  .handler(async ({ data, context }): Promise<ExecuteCommandResponse> => {
    const { supabase, userId } = context;
    const startedAt = Date.now();

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("No organization found for user");
    const orgId = profile.organization_id;

    // RLS keeps this scoped to the caller's org, but we still verify match.
    const { data: entry, error: entryErr } = await supabase
      .from("advisor_audit_log")
      .select("id, command, plan, organization_id")
      .eq("id", data.audit_id)
      .maybeSingle();
    if (entryErr) throw new Error(entryErr.message);
    if (!entry || entry.organization_id !== orgId) {
      throw new Error("Audit entry not found");
    }

    const planObj = (entry.plan ?? null) as AgentPlan | null;
    if (!planObj || !Array.isArray(planObj.actions) || planObj.actions.length === 0) {
      throw new Error("This audit entry has no plan to replay");
    }

    const replayCommand = `[replay] ${entry.command}`;
    const replayCommandId = `replay-${entry.id}-${startedAt}`;
    const { sanitizedActions, results } = await runAdvisorActions({
      supabase,
      organizationId: orgId,
      userId,
      command: replayCommand,
      actions: planObj.actions as AgentAction[],
      chargeCredit: async (action) => {
        const charge = await supabaseAdmin.rpc("consume_credit", {
          p_org_id: orgId,
          p_count: 1,
          p_user_id: userId,
          p_action: `cmd_replay_${action.type}`,
          p_command_id: replayCommandId,
          p_metadata: { audit_id: entry.id },
        });
        const payload = (charge.data ?? {}) as Record<string, unknown>;
        if (charge.error || payload.ok === false) {
          return {
            ok: false,
            reason:
              payload.error === "credits_exhausted"
                ? "Skipped — credits exhausted. Top up in Settings → Billing."
                : "Skipped — credit charge failed.",
          };
        }
        return { ok: true };
      },
    });

    const summary = `Replayed ${sanitizedActions.length} action${sanitizedActions.length === 1 ? "" : "s"} from "${entry.command}"`;

    await logAdvisorExecution({
      supabase: supabaseAdmin,
      organizationId: orgId,
      userId,
      command: replayCommand,
      summary,
      plan: { ...planObj, actions: sanitizedActions, replay_of: entry.id } as unknown,
      results,
      durationMs: Date.now() - startedAt,
    });

    return {
      summary,
      results,
      replay_of: entry.id,
    };
  });
