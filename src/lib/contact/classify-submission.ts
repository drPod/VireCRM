/**
 * Server-only: classify a single contact submission via the Lovable AI
 * gateway and persist the result. Safe to call in fire-and-forget mode —
 * all errors are caught and stamped onto `classification_error` so the
 * cron sweeper can retry later.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<any, any, any, any, any>;

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SENTIMENTS = ["positive", "neutral", "negative", "urgent"] as const;
const TOPICS = [
  "sales",
  "support",
  "partnership",
  "pricing",
  "demo",
  "careers",
  "spam",
  "other",
] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export interface SubmissionToClassify {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  budget: string | null;
}

export interface ClassificationResult {
  sentiment: (typeof SENTIMENTS)[number];
  topic: (typeof TOPICS)[number];
  priority_suggestion: (typeof PRIORITIES)[number];
  intent_summary: string;
}

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    sentiment: { type: "string", enum: SENTIMENTS },
    topic: { type: "string", enum: TOPICS },
    priority_suggestion: { type: "string", enum: PRIORITIES },
    intent_summary: {
      type: "string",
      description: "One short sentence (≤140 chars) capturing what the visitor wants.",
    },
  },
  required: ["sentiment", "topic", "priority_suggestion", "intent_summary"],
  additionalProperties: false,
} as const;

export async function classifySubmissionWithAI(
  submission: SubmissionToClassify,
): Promise<ClassificationResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const userBlock = [
    `From: ${submission.name} <${submission.email}>`,
    submission.company ? `Company: ${submission.company}` : null,
    submission.budget ? `Budget: ${submission.budget}` : null,
    "",
    submission.message,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You triage inbound contact-form submissions for a B2B CRM company. " +
            "Classify sentiment, topic, suggested follow-up priority, and write a one-line intent summary. " +
            "Be skeptical: vague or low-effort messages are usually low priority. Mark obvious junk as topic=spam, priority=low.",
        },
        { role: "user", content: userBlock },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "classify_submission",
            description: "Submit the structured classification for this contact form message.",
            parameters: TOOL_SCHEMA,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "classify_submission" } },
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit (429)");
  if (res.status === 402) throw new Error("AI credits exhausted (402)");
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI did not return a tool call");

  const parsed = JSON.parse(args) as ClassificationResult;
  if (!SENTIMENTS.includes(parsed.sentiment)) throw new Error(`Bad sentiment: ${parsed.sentiment}`);
  if (!TOPICS.includes(parsed.topic)) throw new Error(`Bad topic: ${parsed.topic}`);
  if (!PRIORITIES.includes(parsed.priority_suggestion))
    throw new Error(`Bad priority: ${parsed.priority_suggestion}`);
  parsed.intent_summary = (parsed.intent_summary ?? "").toString().slice(0, 280);
  return parsed;
}

/**
 * Classify + persist. Never throws — returns ok/false so callers can run
 * this fire-and-forget without poisoning the request lifecycle.
 */
export async function classifyAndStore(
  supabase: AdminClient,
  submission: SubmissionToClassify,
): Promise<{ ok: boolean; error?: string; result?: ClassificationResult }> {
  try {
    const result = await classifySubmissionWithAI(submission);
    const { error } = await supabase
      .from("contact_submissions")
      .update({
        sentiment: result.sentiment,
        topic: result.topic,
        priority_suggestion: result.priority_suggestion,
        intent_summary: result.intent_summary,
        classified_at: new Date().toISOString(),
        classification_error: null,
      } as any)
      .eq("id", submission.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown classification error";
    console.warn("classify-submission: failed", { id: submission.id, msg });
    await supabase
      .from("contact_submissions")
      .update({ classification_error: msg.slice(0, 500) } as any)
      .eq("id", submission.id);
    return { ok: false, error: msg };
  }
}
