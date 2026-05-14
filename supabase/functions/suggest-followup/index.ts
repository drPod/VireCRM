/**
 * suggest-followup
 *
 * Generates an AI-drafted next-step message for a single lead OR scans the
 * org for stale leads (idle > N days) and queues suggestions for review.
 *
 * Modes:
 *   { mode: "lead", lead_id }            -> one suggestion for that lead
 *   { mode: "batch", days_idle?: 7 }     -> up to 25 stale leads
 *
 * All generated suggestions land in `lead_followup_suggestions` with
 * status="pending" so a human reviews before send.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LeadRow {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  company: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  next_action: string | null;
  last_contact: string | null;
  score: number | null;
}

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function draftSuggestion(
  lead: LeadRow,
  industry: string | null,
): Promise<{
  subject: string;
  message: string;
  reasoning: string;
} | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const lastTouch = lead.last_contact
    ? new Date(lead.last_contact).toISOString().slice(0, 10)
    : "never";
  const sys = `You are a CRM copywriter for a ${industry ?? "B2B"} business. Draft a concise, specific follow-up email (<120 words) for a lead. Tone: warm, professional, no fluff. Always include a clear next-step ask.`;
  const user = `Lead: ${lead.name}${lead.company ? ` at ${lead.company}` : ""}
Status: ${lead.status}
Source: ${lead.source ?? "unknown"}
Last contact: ${lastTouch}
Notes: ${lead.notes ?? "none"}
Next action on file: ${lead.next_action ?? "none"}

Draft the follow-up message now.`;

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "draft_followup",
            description: "Return a follow-up email draft.",
            parameters: {
              type: "object",
              properties: {
                subject: { type: "string", description: "Email subject line, <60 chars" },
                message: { type: "string", description: "Email body, plain text, <120 words" },
                reasoning: {
                  type: "string",
                  description: "1-2 sentence rationale for the angle/ask",
                },
              },
              required: ["subject", "message", "reasoning"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "draft_followup" } },
    }),
  });

  if (res.status === 429)
    throw new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (res.status === 402)
    throw new Response(
      JSON.stringify({ error: "AI credits exhausted. Add credits to keep using AI follow-up." }),
      { status: 402, headers: { ...cors, "Content-Type": "application/json" } },
    );
  if (!res.ok) {
    const text = await res.text();
    console.error("AI gateway error", res.status, text);
    return null;
  }

  const data = await res.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) return null;
  try {
    const parsed = JSON.parse(call.function.arguments);
    return { subject: parsed.subject, message: parsed.message, reasoning: parsed.reasoning };
  } catch (e) {
    console.error("Failed to parse AI tool call", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use the caller's JWT for auth (so we know who they are + RLS for reads),
    // but use the service-role client to insert suggestions so the inserts
    // are auditable and bypass any future user-level write restrictions.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "batch" ? "batch" : "lead";

    // Resolve org for the caller
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization for user" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const orgId = profile.organization_id;

    const { data: org } = await admin
      .from("organizations")
      .select("industry_template")
      .eq("id", orgId)
      .maybeSingle();
    const industry = (org?.industry_template as string | null) ?? null;

    // Build the candidate lead set
    let leads: LeadRow[] = [];
    if (mode === "lead") {
      if (!body.lead_id) {
        return new Response(JSON.stringify({ error: "lead_id required" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await admin
        .from("leads")
        .select(
          "id, organization_id, name, email, company, status, source, notes, next_action, last_contact, score",
        )
        .eq("id", body.lead_id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Lead not found" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      leads = [data as LeadRow];
    } else {
      const daysIdle = Math.max(1, Math.min(60, Number(body.days_idle ?? 7)));
      const cutoff = new Date(Date.now() - daysIdle * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await admin
        .from("leads")
        .select(
          "id, organization_id, name, email, company, status, source, notes, next_action, last_contact, score",
        )
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .not("status", "in", '("won","lost","unqualified")')
        .or(`last_contact.lt.${cutoff},last_contact.is.null`)
        .order("score", { ascending: false, nullsFirst: false })
        .limit(25);
      leads = (data ?? []) as LeadRow[];
    }

    const created: { lead_id: string; suggestion_id: string }[] = [];
    const drafts: { lead_id: string; subject: string; message: string; reasoning: string }[] = [];
    let errors = 0;

    for (const lead of leads) {
      try {
        const draft = await draftSuggestion(lead, industry);
        if (!draft) {
          errors++;
          continue;
        }
        const { data: ins, error: insErr } = await admin
          .from("lead_followup_suggestions")
          .insert({
            lead_id: lead.id,
            organization_id: orgId,
            channel: "email",
            subject: draft.subject,
            message: draft.message,
            reasoning: draft.reasoning,
            model: MODEL,
            status: "pending",
            source: mode === "batch" ? "batch" : "on_demand",
            created_by: user.id,
          })
          .select("id")
          .single();
        if (insErr || !ins) {
          errors++;
          continue;
        }
        created.push({ lead_id: lead.id, suggestion_id: ins.id });
        drafts.push({
          lead_id: lead.id,
          subject: draft.subject,
          message: draft.message,
          reasoning: draft.reasoning,
        });
      } catch (e) {
        // If draftSuggestion threw a Response (rate-limit/credit), bubble it up
        if (e instanceof Response) return e;
        console.error("draft error for lead", lead.id, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode,
        processed: leads.length,
        created: created.length,
        errors,
        // Single-lead callers (per-lead AI button) need the actual draft to show
        // in the dialog; batch callers just need counts.
        suggestion: mode === "lead" ? (drafts[0] ?? null) : undefined,
        drafts: mode === "lead" ? undefined : drafts,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("suggest-followup fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }
});
