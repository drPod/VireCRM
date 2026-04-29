/**
 * Agent: personalize-message
 *
 * Takes a template (subject + body with optional {{placeholders}}) and a
 * lead, and returns a personalized version that reads like it was hand-written
 * for that lead — same intent, same call-to-action, but warmer specifics.
 *
 * Body:
 *   { lead_id: string, subject?: string, body: string, tone?: string }
 *
 * Returns: { subject, body, changes }
 */
import { withAgent, callStructured, jsonResponse } from "../_shared/ai-agent.ts";

export default withAgent(async (req, ctx) => {
  const body = await req.json().catch(() => ({}));
  const leadId = body.lead_id;
  const templateBody = body.body;
  if (!leadId || !templateBody) {
    return jsonResponse({ error: "lead_id and body required" }, 400);
  }
  const tone = body.tone ?? "warm, professional";
  const templateSubject = body.subject ?? "";

  const { data: lead, error } = await ctx.admin
    .from("leads")
    .select("name, company, status, source, notes")
    .eq("id", leadId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (error || !lead) return jsonResponse({ error: "Lead not found" }, 404);

  const result = await callStructured<{
    subject: string;
    body: string;
    changes: string[];
  }>({
    system: `You personalize sales/CRM messages for a ${ctx.industry ?? "B2B"} business. Keep the original intent and call-to-action. Tone: ${tone}. Replace any {{placeholders}} with real values. Don't invent facts not present in the lead context.`,
    user: `Lead context:
- Name: ${lead.name}
- Company: ${lead.company ?? "unknown"}
- Status: ${lead.status}
- Source: ${lead.source ?? "unknown"}
- Notes: ${lead.notes ?? "none"}

Original subject: ${templateSubject || "(none)"}
Original body:
"""
${templateBody}
"""

Rewrite to feel personal to this lead.`,
    toolName: "submit_personalization",
    toolDescription: "Return a personalized subject + body.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
        changes: {
          type: "array",
          items: { type: "string" },
          description: "Short bullets describing what was personalized.",
        },
      },
      required: ["subject", "body", "changes"],
    },
  });

  return jsonResponse({ ok: true, ...result });
});
