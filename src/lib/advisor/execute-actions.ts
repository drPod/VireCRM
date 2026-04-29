import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchToN8n, loadN8nWebhookMap } from "@/lib/n8n/dispatch";

// ---------- Action types the executor accepts ----------

export interface CreateTaskAction {
  type: "create_task";
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  due_in_days?: number;
  lead_match?: string;
}
export interface DraftMessageAction {
  type: "draft_message";
  subject: string;
  body: string;
  lead_match?: string;
}
export interface ScoreLeadsAction {
  type: "score_leads";
  criteria: string;
  score_delta: number;
  status_filter?: string;
  max_leads?: number;
}
export interface CreateCampaignAction {
  type: "create_campaign";
  name: string;
  objective?: string;
}
export interface PipelineSummaryAction {
  type: "pipeline_summary";
}
export interface NoteAction {
  type: "note";
  message: string;
}
export interface UpdateLeadStatusAction {
  type: "update_lead_status";
  lead_match: string;
  new_status: "new" | "contacted" | "qualified" | "negotiation" | "won" | "lost";
  reason?: string;
}
export interface LogMessageAction {
  type: "log_message";
  channel?: "email" | "sms" | "call" | "note";
  direction?: "outbound" | "inbound";
  subject?: string;
  body: string;
  lead_match?: string;
}
export interface ScheduleFollowUpAction {
  type: "schedule_follow_up";
  lead_match: string;
  in_days: number;
  channel?: "email" | "call" | "meeting" | "task";
  notes?: string;
}
export interface CreateLeadAction {
  type: "create_lead";
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: "new" | "contacted" | "qualified" | "negotiation" | "won" | "lost";
  notes?: string;
}

export type AgentAction =
  | CreateTaskAction
  | DraftMessageAction
  | ScoreLeadsAction
  | CreateCampaignAction
  | PipelineSummaryAction
  | NoteAction
  | UpdateLeadStatusAction
  | LogMessageAction
  | ScheduleFollowUpAction
  | CreateLeadAction;

export interface AgentPlan {
  summary: string;
  actions: AgentAction[];
}

export interface ExecutionResult {
  type: AgentAction["type"];
  status: "ok" | "skipped" | "error";
  message: string;
  handler?: "n8n" | "in_app";
  meta?: Record<string, string | number | null>;
}

// ---------- Guardrails (shared) ----------

export const ALLOWED_ACTIONS = new Set<AgentAction["type"]>([
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
]);

/**
 * Action types that perform a real CRM mutation and should be metered against
 * the org's credit balance. Read-only / explanatory actions are free.
 */
export const BILLABLE_ACTIONS = new Set<AgentAction["type"]>([
  "create_task",
  "draft_message",
  "score_leads",
  "create_campaign",
  "update_lead_status",
  "log_message",
  "schedule_follow_up",
  "create_lead",
]);

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

interface RunActionsArgs {
  /** Authenticated user-scoped client (used for reads). */
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  command: string;
  actions: AgentAction[];
  /**
   * Optional credit-gating callback. Called once per BILLABLE action right
   * before execution. Return `{ ok: true }` to proceed, or `{ ok: false,
   * reason }` to skip the action and emit a "credits exhausted" result.
   */
  chargeCredit?: (action: AgentAction) => Promise<{ ok: boolean; reason?: string }>;
}

/**
 * Apply the allowlist, route to n8n if a webhook is configured, otherwise
 * perform the in-app DB write. Mirrors the behavior of the original inline
 * loop in `executeCommandActionsFn` so replays use identical guardrails.
 */
export async function runAdvisorActions({
  supabase,
  organizationId: orgId,
  userId,
  command,
  actions,
  chargeCredit,
}: RunActionsArgs): Promise<{
  sanitizedActions: AgentAction[];
  results: ExecutionResult[];
}> {
  const results: ExecutionResult[] = [];
  const n8nWebhooks = await loadN8nWebhookMap(supabase, orgId);

  // Hard allowlist: drop anything else with a skipped note.
  const sanitizedActions: AgentAction[] = [];
  for (const a of actions ?? []) {
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

  async function resolveLead(
    match?: string,
  ): Promise<{ id: string; name: string } | null> {
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

  for (const action of sanitizedActions) {
    // Credit gate: charge billable actions BEFORE any side-effect runs.
    if (chargeCredit && BILLABLE_ACTIONS.has(action.type)) {
      const charge = await chargeCredit(action);
      if (!charge.ok) {
        results.push({
          type: action.type,
          status: "skipped",
          handler: "in_app",
          message:
            charge.reason ??
            "Skipped — your workspace is out of credits. Top up in Settings → Billing to run this action.",
        });
        continue;
      }
    }

    if (action.type !== "note") {
      const webhook = n8nWebhooks[action.type];
      if (webhook) {
        const dispatch = await dispatchToN8n(webhook, {
          action_type: action.type,
          organization_id: orgId,
          user_id: userId,
          command,
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
          const title = typeof action.title === "string" ? action.title.trim() : "";
          if (!title) {
            results.push({
              type: "create_task",
              status: "skipped",
              message: "AI did not provide a task title.",
            });
            break;
          }
          const lead = await resolveLead(action.lead_match);
          const { data: row, error } = await supabaseAdmin
            .from("tasks")
            .insert({
              organization_id: orgId,
              title: title.slice(0, 200),
              description: typeof action.description === "string" ? action.description.slice(0, 2000) : null,
              priority: priorityValue(action.priority),
              due_date: dueDateFromDays(action.due_in_days),
              lead_id: lead?.id ?? null,
              assigned_to: userId,
              status: "todo",
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
          const ids = updates.map((u) => u.id);
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

        case "update_lead_status": {
          const lead = await resolveLead(action.lead_match);
          if (!lead) {
            results.push({
              type: "update_lead_status",
              status: "skipped",
              message: `No lead matched "${action.lead_match}"`,
            });
            break;
          }
          const { error } = await supabaseAdmin
            .from("leads")
            .update({
              status: action.new_status,
              ...(action.reason ? { next_action: action.reason.slice(0, 500) } : {}),
            })
            .eq("id", lead.id)
            .eq("organization_id", orgId);
          if (error) throw error;
          results.push({
            type: "update_lead_status",
            status: "ok",
            message: `Moved ${lead.name} to "${action.new_status}"${action.reason ? ` — ${action.reason}` : ""}`,
            meta: { lead_id: lead.id, new_status: action.new_status },
          });
          break;
        }

        case "log_message": {
          const lead = await resolveLead(action.lead_match);
          const channel = action.channel ?? "note";
          const directionPrefix =
            action.direction === "inbound"
              ? "[inbound] "
              : action.direction === "outbound"
                ? "[outbound] "
                : "";
          const { data: row, error } = await supabaseAdmin
            .from("messages")
            .insert({
              organization_id: orgId,
              lead_id: lead?.id ?? null,
              type: channel,
              status: "logged",
              subject: action.subject?.slice(0, 200) ?? null,
              content: (directionPrefix + action.body).slice(0, 5000),
            })
            .select("id")
            .single();
          if (error) throw error;
          if (lead && action.direction !== "inbound") {
            await supabaseAdmin
              .from("leads")
              .update({ last_contact: new Date().toISOString() })
              .eq("id", lead.id)
              .eq("organization_id", orgId);
          }
          results.push({
            type: "log_message",
            status: "ok",
            message: `Logged ${channel}${lead ? ` with ${lead.name}` : ""}${action.subject ? `: "${action.subject}"` : ""}`,
            meta: { message_id: row.id, lead_id: lead?.id ?? null, channel },
          });
          break;
        }

        case "schedule_follow_up": {
          const lead = await resolveLead(action.lead_match);
          if (!lead) {
            results.push({
              type: "schedule_follow_up",
              status: "skipped",
              message: `No lead matched "${action.lead_match}"`,
            });
            break;
          }
          const days = Math.max(1, Math.min(Math.round(action.in_days || 1), 90));
          const due = new Date();
          due.setDate(due.getDate() + days);
          const channel = action.channel ?? "task";
          const title = `Follow up with ${lead.name}${channel !== "task" ? ` (${channel})` : ""}`;
          const { data: row, error } = await supabaseAdmin
            .from("tasks")
            .insert({
              organization_id: orgId,
              title: title.slice(0, 200),
              description: action.notes?.slice(0, 2000) ?? null,
              priority: "medium",
              due_date: due.toISOString(),
              lead_id: lead.id,
              assigned_to: userId,
              status: "todo",
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({
            type: "schedule_follow_up",
            status: "ok",
            message: `Follow-up scheduled with ${lead.name} in ${days} day${days === 1 ? "" : "s"} via ${channel}`,
            meta: { task_id: row.id, lead_id: lead.id, in_days: days },
          });
          break;
        }

        case "create_lead": {
          const name = (action.name ?? "").trim();
          if (!name) {
            results.push({
              type: "create_lead",
              status: "skipped",
              message: "No name provided for new lead.",
            });
            break;
          }
          const email = action.email?.trim() || null;
          // De-dupe by email within the org if one is provided.
          if (email) {
            const { data: existing } = await supabase
              .from("leads")
              .select("id, name")
              .eq("organization_id", orgId)
              .eq("email", email)
              .maybeSingle();
            if (existing) {
              results.push({
                type: "create_lead",
                status: "skipped",
                message: `Lead already exists for ${email} (${existing.name})`,
                meta: { lead_id: existing.id },
              });
              break;
            }
          }
          const { data: row, error } = await supabaseAdmin
            .from("leads")
            .insert({
              organization_id: orgId,
              name: name.slice(0, 200),
              company: action.company?.slice(0, 200) ?? null,
              email,
              phone: action.phone?.slice(0, 50) ?? null,
              source: action.source?.slice(0, 100) ?? "ai_command_center",
              status: action.status ?? "new",
              notes: action.notes?.slice(0, 2000) ?? null,
              created_by: userId,
              assigned_to: userId,
              score: 50,
            })
            .select("id")
            .single();
          if (error) throw error;
          results.push({
            type: "create_lead",
            status: "ok",
            message: `Created lead "${name}"${action.company ? ` @ ${action.company}` : ""}`,
            meta: { lead_id: row.id },
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

    const last = results[results.length - 1];
    if (last && !last.handler) {
      last.handler = "in_app";
    }
  }

  return { sanitizedActions, results };
}
