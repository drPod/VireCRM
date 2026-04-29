/**
 * Agent: score-lead
 *
 * Computes a 0-100 fit/intent score for a lead based on its profile,
 * notes, and recent activity. Persists `leads.score` and `leads.score_reason`.
 *
 * Body: { lead_id: string }
 * Returns: { score, reason, signals }
 */
import { withAgent, callStructured, jsonResponse } from "../_shared/ai-agent.ts";

Deno.serve(withAgent(async (req, ctx) => {
  const body = await req.json().catch(() => ({}));
  const leadId = body.lead_id;
  if (!leadId) return jsonResponse({ error: "lead_id required" }, 400);

  const { data: lead, error } = await ctx.admin
    .from("leads")
    .select("id, organization_id, name, email, company, status, source, notes, last_contact, score")
    .eq("id", leadId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (error || !lead) return jsonResponse({ error: "Lead not found" }, 404);

  const lastTouch = lead.last_contact ? new Date(lead.last_contact).toISOString().slice(0, 10) : "never";
  const result = await callStructured<{
    score: number;
    reason: string;
    signals: { positive: string[]; negative: string[] };
  }>({
    system: `You are a sales lead scoring agent for a ${ctx.industry ?? "B2B"} business. Score 0-100 where 100 = highly qualified, ready-to-buy. Be specific and skeptical — don't inflate.`,
    user: `Lead: ${lead.name}${lead.company ? ` at ${lead.company}` : ""}
Email: ${lead.email ?? "none"}
Status: ${lead.status}
Source: ${lead.source ?? "unknown"}
Last contact: ${lastTouch}
Notes: ${lead.notes ?? "none"}

Score this lead now.`,
    toolName: "submit_score",
    toolDescription: "Submit a 0-100 lead score with rationale.",
    parameters: {
      type: "object",
      properties: {
        score: { type: "number", description: "0-100 integer" },
        reason: { type: "string", description: "1-2 sentence rationale" },
        signals: {
          type: "object",
          properties: {
            positive: { type: "array", items: { type: "string" } },
            negative: { type: "array", items: { type: "string" } },
          },
          required: ["positive", "negative"],
        },
      },
      required: ["score", "reason", "signals"],
    },
  });

  const clamped = Math.max(0, Math.min(100, Math.round(result.score)));
  await ctx.admin
    .from("leads")
    .update({ score: clamped, score_reason: result.reason })
    .eq("id", leadId);

  return jsonResponse({ ok: true, score: clamped, reason: result.reason, signals: result.signals });
}));
