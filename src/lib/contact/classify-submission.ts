/**
 * Server-only: classify a single contact submission and persist the result.
 * Safe to call fire-and-forget — all errors are caught and stamped onto
 * `classification_error` so the cron sweeper can retry later.
 *
 * Goes through `callAiWithFallback` so it inherits the same model-fallback,
 * prompt caching, hard-error routing, and telemetry as every other AI
 * feature (advisor, command bar, auto-outreach, etc.).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { callAiWithFallback, DEFAULT_TEXT_MODELS } from "@/lib/ai-gateway";

type AdminClient = SupabaseClient<any, any, any, any, any>;

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

const SYSTEM_PROMPT =
  "You triage inbound contact-form submissions for a B2B CRM company. " +
  "Classify sentiment, topic, suggested follow-up priority, and write a one-line intent summary. " +
  "Be skeptical: vague or low-effort messages are usually low priority. Mark obvious junk as topic=spam, priority=low.";

export async function classifySubmissionWithAI(
  submission: SubmissionToClassify,
): Promise<ClassificationResult> {
  const userBlock = [
    `From: ${submission.name} <${submission.email}>`,
    submission.company ? `Company: ${submission.company}` : null,
    submission.budget ? `Budget: ${submission.budget}` : null,
    "",
    submission.message,
  ]
    .filter(Boolean)
    .join("\n");

  const parsed = await callAiWithFallback<ClassificationResult>({
    featureLabel: "Contact submission classify",
    models: DEFAULT_TEXT_MODELS,
    toolName: "classify_submission",
    toolDescription: "Submit the structured classification for this contact form message.",
    toolSchema: TOOL_SCHEMA as Record<string, any>,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: userBlock,
  });

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
