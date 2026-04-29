/**
 * Agent: book-appointment
 *
 * Reads a lead's most recent inbound message, extracts a proposed time
 * (or asks the AI to pick the best slot from supplied availability), and
 * either creates an `appointments` row directly or returns a suggestion
 * for human confirmation.
 *
 * Body:
 *   {
 *     lead_id: string,
 *     reply_text?: string,                // free-text from the lead
 *     duration_minutes?: number,          // default 30
 *     availability?: { starts_at: string, ends_at: string }[],
 *     auto_book?: boolean,                // default false
 *     calendar_id?: string,
 *   }
 *
 * Returns: { suggestion, appointment_id? }
 */
import { withAgent, callStructured, jsonResponse } from "../_shared/ai-agent.ts";

Deno.serve(withAgent(async (req, ctx) => {
  const body = await req.json().catch(() => ({}));
  const leadId = body.lead_id;
  if (!leadId) return jsonResponse({ error: "lead_id required" }, 400);
  const duration = Math.max(10, Math.min(240, Number(body.duration_minutes ?? 30)));

  const { data: lead, error } = await ctx.admin
    .from("leads")
    .select("id, name, organization_id")
    .eq("id", leadId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (error || !lead) return jsonResponse({ error: "Lead not found" }, 404);

  let replyText: string = body.reply_text ?? "";
  if (!replyText) {
    // Try to pull the most recent inbound message
    const { data: msgs } = await ctx.admin
      .from("messages")
      .select("content, direction, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5);
    const inbound = (msgs ?? []).find((m: { direction?: string }) => m.direction === "inbound") ??
      (msgs ?? [])[0];
    replyText = (inbound?.content ?? "") as string;
  }

  const availability = Array.isArray(body.availability) ? body.availability : [];
  const now = new Date().toISOString();

  const result = await callStructured<{
    confidence: number;
    starts_at: string | null;
    ends_at: string | null;
    title: string;
    rationale: string;
    needs_clarification: boolean;
    clarification_question: string | null;
  }>({
    system: `You are a scheduling agent. Given an inbound reply (and optional availability windows), propose ONE appointment slot in ISO-8601 UTC. If the reply is ambiguous or no good slot fits, set needs_clarification=true and provide a question to ask the lead. Today is ${now}. Default duration: ${duration} minutes.`,
    user: `Lead: ${lead.name}
Inbound reply:
"""
${replyText.slice(0, 2000) || "(none — pick from availability)"}
"""
Availability windows (the picked slot must lie inside one of these, if provided):
${availability.length ? JSON.stringify(availability) : "(no constraint)"}

Propose a slot.`,
    toolName: "submit_booking",
    toolDescription: "Submit a proposed appointment slot or ask for clarification.",
    parameters: {
      type: "object",
      properties: {
        confidence: { type: "number", description: "0-1 confidence in the proposed slot." },
        starts_at: { type: ["string", "null"], description: "ISO-8601 UTC start time." },
        ends_at: { type: ["string", "null"], description: "ISO-8601 UTC end time." },
        title: { type: "string" },
        rationale: { type: "string" },
        needs_clarification: { type: "boolean" },
        clarification_question: { type: ["string", "null"] },
      },
      required: ["confidence", "starts_at", "ends_at", "title", "rationale", "needs_clarification", "clarification_question"],
    },
  });

  let appointmentId: string | null = null;
  const canBook = body.auto_book === true && !result.needs_clarification && result.starts_at && result.ends_at && result.confidence >= 0.6;
  if (canBook) {
    const { data: appt, error: insErr } = await ctx.admin
      .from("appointments")
      .insert({
        organization_id: ctx.orgId,
        lead_id: leadId,
        title: result.title,
        starts_at: result.starts_at,
        ends_at: result.ends_at,
        status: "scheduled",
        calendar_id: body.calendar_id ?? null,
        notes: `Auto-booked by AI agent. Rationale: ${result.rationale}`,
      })
      .select("id")
      .single();
    if (!insErr && appt) appointmentId = appt.id;
    else console.error("appointment insert failed", insErr);
  }

  return jsonResponse({
    ok: true,
    suggestion: result,
    appointment_id: appointmentId,
    booked: !!appointmentId,
  });
});
);
