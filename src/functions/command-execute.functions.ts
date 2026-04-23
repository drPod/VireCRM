import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiWithFallback, DEFAULT_TEXT_MODELS } from "@/lib/ai-gateway";
import { dispatchToN8n, loadN8nWebhookMap } from "@/lib/n8n/dispatch";
import { logAdvisorExecution } from "@/lib/advisor-audit";
import { z } from "zod";

/**
 * Execute the user's command by running the AI as an "agent" that picks
 * concrete actions to perform on their CRM (tasks, message drafts, lead
 * scoring tweaks, campaigns, summaries). All actions are non-integration
 * — they only touch our own database. Outbound email/integration work is
 * handled elsewhere by Auto Outreach + the Connectors panel.
 */

const executeSchema = z.object({
  command: z.string().min(1).max(500),
});

// ---------- Action types the AI is allowed to emit ----------

interface CreateTaskAction {
  type: "create_task";
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  due_in_days?: number;
  lead_match?: string; // free-text name/company; we resolve to lead_id
}

interface DraftMessageAction {
  type: "draft_message";
  subject: string;
  body: string;
  lead_match?: string;
}

interface ScoreLeadsAction {
  type: "score_leads";
  criteria: string; // e.g. "engaged in last 14 days"
  score_delta: number; // -50..+50
  status_filter?: string; // optional pipeline status
  max_leads?: number;
}

interface CreateCampaignAction {
  type: "create_campaign";
  name: string;
  objective?: string;
}

interface PipelineSummaryAction {
  type: "pipeline_summary";
}

interface NoteAction {
  type: "note";
  message: string; // explanatory note shown to the user, no DB side-effect
}

interface UpdateLeadStatusAction {
  type: "update_lead_status";
  lead_match: string;
  new_status: "new" | "contacted" | "qualified" | "negotiation" | "won" | "lost";
  reason?: string;
}

interface LogMessageAction {
  type: "log_message";
  /** Channel of the logged message. */
  channel?: "email" | "sms" | "call" | "note";
  /** Direction is informational; stored on the messages.type field. */
  direction?: "outbound" | "inbound";
  subject?: string;
  body: string;
  lead_match?: string;
}

interface ScheduleFollowUpAction {
  type: "schedule_follow_up";
  lead_match: string;
  /** Days from now (1..90). */
  in_days: number;
  channel?: "email" | "call" | "meeting" | "task";
  notes?: string;
}

type AgentAction =
  | CreateTaskAction
  | DraftMessageAction
  | ScoreLeadsAction
  | CreateCampaignAction
  | PipelineSummaryAction
  | NoteAction
  | UpdateLeadStatusAction
  | LogMessageAction
  | ScheduleFollowUpAction;

interface AgentPlan {
  summary: string;
  actions: AgentAction[];
}

// ---------- Result shape returned to the client ----------

export interface ExecutionResult {
  type: AgentAction["type"];
  status: "ok" | "skipped" | "error";
  message: string;
  /** "n8n" if handled by an external n8n webhook, "in_app" otherwise. */
  handler?: "n8n" | "in_app";
  meta?: Record<string, string | number | null>;
}

export interface ExecuteCommandResponse {
  summary: string;
  results: ExecutionResult[];
}

// ---------- Helpers ----------

function priorityValue(p?: string): "low" | "medium" | "high" | "urgent" {
  if (p === "low" || p === "medium" || p === "high" || p === "urgent") return p;
  return "medium";
}

function dueDateFromDays(days?: number): string | null {
  if (typeof days !== "number" || !Number.isFinite(days) || days < 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + Math.min(days, 365));
  return d.toISOString();
}

// ---------- Server function ----------

export const executeCommandActionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    // Quick context: counts + a few recent leads to ground the AI.
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
      .map((l) => `- ${l.name}${l.company ? ` @ ${l.company}` : ""} [status=${l.status}, score=${l.score ?? "?"}]`)
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
- create_task: schedule a generic to-do for the user. Use for "remind me", "todo".
- schedule_follow_up: schedule a dated follow-up tied to a specific lead. Use for "follow up with X in 3 days", "check back next week with Y". Requires lead_match and in_days.
- draft_message: write a personalized outreach draft saved to Messages as a DRAFT (NOT sent). Use for "write an email to ...", "draft a follow-up".
- log_message: record an already-occurred conversation (logged call, sent email, inbound reply) onto a lead's history. Use for "log that I called X yesterday", "log inbound reply from Y". Stored as status="logged" so it's not confused with drafts.
- update_lead_status: move a lead through the pipeline (new → contacted → qualified → negotiation → won/lost). Use for "mark X as qualified", "move Y to negotiation".
- score_leads: bulk-adjust scores on leads matching simple criteria. Use for "score my hot leads", "deprioritize cold leads".
- create_campaign: create a new campaign shell. Use for "start a campaign for ...".
- pipeline_summary: produce a written summary of pipeline health (no DB writes — the server fills the data).
- note: a plain explanation, used when no real action fits or to clarify what you skipped.

GUARDRAILS — you must obey:
- You operate ONLY on existing CRM data. You CANNOT contact leads, send emails/SMS, dial phones, post to social, or trigger any external integration. Email "drafts" are saved to the Messages table for the user to review and send manually. log_message is for recording activity that already happened — it does not contact anyone.
- You CANNOT import, scrape, enrich, or fetch new leads from any external source (Apollo, LinkedIn, Hunter, Snov, web scraping, etc.). If the user asks to "find", "import", "enrich", "scrape", or "auto-source" leads, return a single 'note' action explaining that lead sourcing is handled in the AI Advisor / Auto-Find Leads flow and refuse the request.
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
              },
              required: ["type"],
            },
          },
        },
        required: ["summary", "actions"],
      },
    });

    const results: ExecutionResult[] = [];
    const n8nWebhooks = await loadN8nWebhookMap(supabase, orgId);

    // ---------- Guardrails ----------
    // 1) Block intents that try to contact leads or import new ones. The
    //    Advisor is strictly an in-app reasoning agent — sourcing/contact
    //    flows live in dedicated screens (Auto-Find Leads, Auto Outreach).
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

    // 2) Hard allowlist of action types the executor will run, regardless
    //    of what the AI returned. Anything else is silently dropped with
    //    a skipped note so the user sees what was rejected.
    const ALLOWED_ACTIONS = new Set<AgentAction["type"]>([
      "create_task",
      "draft_message",
      "score_leads",
      "create_campaign",
      "pipeline_summary",
      "note",
    ]);
    const sanitizedActions: AgentAction[] = [];
    for (const a of plan.actions ?? []) {
      if (a && typeof a === "object" && ALLOWED_ACTIONS.has(a.type)) {
        sanitizedActions.push(a);
      } else {
        results.push({
          type: "note",
          status: "skipped",
          handler: "in_app",
          message: `Guardrail: dropped unsupported action "${(a as { type?: string })?.type ?? "unknown"}".`,
        });
      }
    }
    plan.actions = sanitizedActions;
    // Resolve lead matches (case-insensitive name OR company contains).
    async function resolveLead(match?: string): Promise<{ id: string; name: string } | null> {
      if (!match) return null;
      const term = match.trim();
      if (!term) return null;
      const { data: hits } = await supabase
        .from("leads")
        .select("id, name")
        .eq("organization_id", orgId)
        .or(`name.ilike.%${term}%,company.ilike.%${term}%`)
        .limit(1);
      return hits?.[0] ?? null;
    }

    for (const action of plan.actions ?? []) {
      // Hybrid routing: if an n8n webhook is registered for this action
      // type, hand off to n8n and skip the in-app branch. Note actions
      // are always in-app (they are pure UI text).
      if (action.type !== "note") {
        const webhook = n8nWebhooks[action.type];
        if (webhook) {
          const dispatch = await dispatchToN8n(webhook, {
            action_type: action.type,
            organization_id: orgId,
            user_id: userId,
            command: data.command,
            payload: action,
          });
          if (dispatch) {
            results.push({
              type: action.type,
              status: dispatch.status,
              handler: "n8n",
              message: dispatch.message,
              meta: dispatch.http_status
                ? { http_status: dispatch.http_status }
                : undefined,
            });
            continue;
          }
        }
      }

      try {
        switch (action.type) {
          case "create_task": {
            const lead = await resolveLead(action.lead_match);
            const { data: row, error } = await supabaseAdmin
              .from("tasks")
              .insert({
                organization_id: orgId,
                title: action.title.slice(0, 200),
                description: action.description?.slice(0, 2000) ?? null,
                priority: priorityValue(action.priority),
                due_date: dueDateFromDays(action.due_in_days),
                lead_id: lead?.id ?? null,
                assigned_to: userId,
                status: "pending",
              })
              .select("id")
              .single();
            if (error) throw error;
            results.push({
              type: "create_task",
              status: "ok",
              message: `Task created: "${action.title}"${lead ? ` for ${lead.name}` : ""}`,
              meta: { task_id: row.id, lead_id: lead?.id ?? null },
            });
            break;
          }

          case "draft_message": {
            const lead = await resolveLead(action.lead_match);
            const { data: row, error } = await supabaseAdmin
              .from("messages")
              .insert({
                organization_id: orgId,
                lead_id: lead?.id ?? null,
                type: "email",
                status: "draft",
                subject: action.subject.slice(0, 200),
                content: action.body.slice(0, 5000),
              })
              .select("id")
              .single();
            if (error) throw error;
            results.push({
              type: "draft_message",
              status: "ok",
              message: `Email draft saved${lead ? ` for ${lead.name}` : ""}: "${action.subject}"`,
              meta: { message_id: row.id, lead_id: lead?.id ?? null },
            });
            break;
          }

          case "score_leads": {
            const delta = Math.max(-50, Math.min(50, Math.round(action.score_delta || 0)));
            const limit = Math.max(1, Math.min(action.max_leads ?? 50, 200));
            let q = supabase
              .from("leads")
              .select("id, score")
              .eq("organization_id", orgId)
              .order("updated_at", { ascending: false })
              .limit(limit);
            if (action.status_filter) {
              q = q.eq("status", action.status_filter);
            }
            const { data: targets, error } = await q;
            if (error) throw error;
            if (!targets?.length) {
              results.push({
                type: "score_leads",
                status: "skipped",
                message: `No leads matched: "${action.criteria}"`,
              });
              break;
            }
            const updates = targets.map((l) => ({
              id: l.id,
              score: Math.max(0, Math.min(100, (l.score ?? 50) + delta)),
            }));
            // Apply one-by-one via admin to bypass RLS noise but stay within org via id list
            const ids = updates.map((u) => u.id);
            // Issue per-row updates in parallel (small N).
            await Promise.all(
              updates.map((u) =>
                supabaseAdmin
                  .from("leads")
                  .update({ score: u.score })
                  .eq("id", u.id)
                  .eq("organization_id", orgId),
              ),
            );
            results.push({
              type: "score_leads",
              status: "ok",
              message: `Adjusted score by ${delta > 0 ? "+" : ""}${delta} on ${ids.length} lead${ids.length === 1 ? "" : "s"} (${action.criteria})`,
              meta: { updated: ids.length, delta },
            });
            break;
          }

          case "create_campaign": {
            const { data: row, error } = await supabaseAdmin
              .from("campaigns")
              .insert({
                organization_id: orgId,
                name: action.name.slice(0, 200),
                objective: action.objective?.slice(0, 500) ?? null,
                status: "draft",
              })
              .select("id")
              .single();
            if (error) throw error;
            results.push({
              type: "create_campaign",
              status: "ok",
              message: `Campaign created: "${action.name}"`,
              meta: { campaign_id: row.id },
            });
            break;
          }

          case "pipeline_summary": {
            const { data: byStatus } = await supabase
              .from("leads")
              .select("status")
              .eq("organization_id", orgId);
            const counts = (byStatus ?? []).reduce<Record<string, number>>((acc, r) => {
              acc[r.status] = (acc[r.status] ?? 0) + 1;
              return acc;
            }, {});
            const top = Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            results.push({
              type: "pipeline_summary",
              status: "ok",
              message: top ? `Pipeline — ${top}` : "Pipeline is empty.",
              meta: { total: byStatus?.length ?? 0 },
            });
            break;
          }

          case "note":
          default: {
            results.push({
              type: "note",
              status: "ok",
              message: (action as NoteAction).message ?? "Noted.",
            });
            break;
          }
        }
      } catch (err) {
        results.push({
          type: action.type,
          status: "error",
          message: err instanceof Error ? err.message : "Action failed",
        });
      }

      // Tag the in-app branch result(s) added in this iteration. Anything
      // dispatched to n8n already `continue`d before reaching here.
      const last = results[results.length - 1];
      if (last && !last.handler) {
        last.handler = "in_app";
      }
    }

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
