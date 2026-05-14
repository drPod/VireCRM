/**
 * Agent: classify-reply
 *
 * Classifies an inbound message into intent + sentiment + suggested next step.
 * Optionally updates the source row (messages or conversation_messages) with
 * sentiment + intent so downstream workflows can branch on it.
 *
 * Body:
 *   { text: string, lead_id?: string }                    -> classify only
 *   { message_id: string, table?: "messages" | "conversation_messages" }
 *
 * Returns: { intent, sentiment, urgency, suggested_action, summary }
 */
import { withAgent, callStructured, jsonResponse } from "../_shared/ai-agent.ts";

const INTENTS = [
  "interested",
  "objection",
  "ready_to_buy",
  "needs_info",
  "scheduling",
  "unsubscribe",
  "complaint",
  "spam",
  "other",
];
const SENTIMENTS = ["positive", "neutral", "negative"];
const URGENCIES = ["low", "medium", "high"];

Deno.serve(
  withAgent(async (req, ctx) => {
    const body = await req.json().catch(() => ({}));

    let text: string | null = body.text ?? null;
    let leadId: string | null = body.lead_id ?? null;
    const messageId: string | null = body.message_id ?? null;
    const table = body.table === "conversation_messages" ? "conversation_messages" : "messages";

    if (!text && messageId) {
      const { data, error } = await ctx.admin
        .from(table)
        .select("id, content, lead_id, organization_id")
        .eq("id", messageId)
        .maybeSingle();
      if (error || !data) return jsonResponse({ error: "Message not found" }, 404);
      if (data.organization_id && data.organization_id !== ctx.orgId) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      text = (data.content ?? "") as string;
      leadId = leadId ?? (data.lead_id as string | null);
    }

    if (!text || !text.trim()) return jsonResponse({ error: "text or message_id required" }, 400);

    const result = await callStructured<{
      intent: string;
      sentiment: string;
      urgency: string;
      suggested_action: string;
      summary: string;
    }>({
      system: `You classify inbound CRM replies for a ${ctx.industry ?? "B2B"} business. Be precise. Pick exactly one intent and one sentiment.`,
      user: `Inbound reply:\n"""\n${text.slice(0, 4000)}\n"""\n\nClassify it.`,
      toolName: "classify",
      toolDescription: "Return classification of an inbound reply.",
      parameters: {
        type: "object",
        properties: {
          intent: { type: "string", enum: INTENTS },
          sentiment: { type: "string", enum: SENTIMENTS },
          urgency: { type: "string", enum: URGENCIES },
          suggested_action: { type: "string", description: "One sentence on what to do next." },
          summary: { type: "string", description: "<=20 word summary of the reply." },
        },
        required: ["intent", "sentiment", "urgency", "suggested_action", "summary"],
      },
    });

    // Best-effort write back; ignore if columns don't exist.
    if (messageId) {
      try {
        await ctx.admin
          .from(table)
          .update({ sentiment: result.sentiment, intent: result.intent } as never)
          .eq("id", messageId);
      } catch (e) {
        console.warn("could not write classification to message", e);
      }
    }

    return jsonResponse({ ok: true, lead_id: leadId, ...result });
  }),
);
