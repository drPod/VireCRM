/**
 * Shared helper for calling Anthropic with automatic multi-model fallback.
 * If the primary model fails (transient 5xx, no tool_use returned, malformed
 * arguments), the helper transparently retries with the next model in the list.
 * Hard errors (429 rate limit, 402 quota, 401 auth, 4xx request-shape) short-circuit
 * — fallbacks won't help for those.
 *
 * Phase 1 migration note: previously a Lovable Gateway proxy over multiple
 * providers (Gemini/Claude/etc) using OpenAI-style tool_calls. Now calls
 * Anthropic directly with native tool_use blocks. Public API kept identical
 * so callers (workflows, contact classify, advisor, command, etc.) don't change.
 *
 * Usage:
 *   const args = await callAiWithFallback({
 *     toolName: "analyze_business",
 *     models: DEFAULT_TEXT_MODELS,
 *     systemPrompt,
 *     userPrompt,
 *     toolSchema: { ...JSON schema for the tool's parameters... },
 *     featureLabel: "AI advisor",
 *   });
 *   // args is the parsed JSON object from the tool_use block's input.
 */

import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AiGatewayCallOptions {
  /** Name of the tool/function the model should call. */
  toolName: string;
  /** Models to try in order. The first one that returns a valid tool_use wins. */
  models: string[];
  /** System message content. Cached when ≥1024 tokens on Sonnet 4.6 / ≥4096 on Haiku 4.5. */
  systemPrompt: string;
  /** User message content. */
  userPrompt: string;
  /** JSON schema describing the tool's `parameters` object. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolSchema: Record<string, any>;
  /** Optional human-readable label used only in logs/error messages. */
  featureLabel?: string;
  /** Optional description for the tool — improves model adherence. */
  toolDescription?: string;
  /** Organization the call is being made on behalf of (for log filtering). */
  organizationId?: string | null;
  /** User the call is being made on behalf of. */
  userId?: string | null;
}

type LogStatus =
  | "success"
  | "fallback"
  | "error"
  | "hard_error"
  | "network_error"
  | "no_tool_calls"
  | "malformed_json"
  | "non_json_response";

function logAiCall(entry: {
  feature: string;
  model: string;
  attempt_index: number;
  latency_ms: number;
  status: LogStatus;
  http_status?: number | null;
  error_message?: string | null;
  organization_id?: string | null;
  user_id?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any> | null;
}) {
  void supabaseAdmin
    .from("ai_call_log")
    .insert({
      feature: entry.feature,
      model: entry.model,
      attempt_index: entry.attempt_index,
      latency_ms: entry.latency_ms,
      status: entry.status,
      http_status: entry.http_status ?? null,
      error_message: entry.error_message ?? null,
      organization_id: entry.organization_id ?? null,
      user_id: entry.user_id ?? null,
      metadata: entry.metadata ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn("[ai-gateway] failed to write ai_call_log:", error.message);
    });
}

export class AiGatewayError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

/**
 * `max_tokens` is the per-response cap. We use a tool with constrained schema,
 * so outputs are bounded — 4096 leaves plenty of headroom while keeping cost
 * predictable. Tune up if a specific feature needs long structured output.
 */
const MAX_TOKENS = 4096;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiGatewayError("AI service not configured");
  return new Anthropic({ apiKey });
}

export async function callAiWithFallback<T = unknown>(opts: AiGatewayCallOptions): Promise<T> {
  const client = getClient();
  const label = opts.featureLabel ?? opts.toolName;
  let lastReason: string | null = null;

  for (let i = 0; i < opts.models.length; i++) {
    const model = opts.models[i];
    const isLast = i === opts.models.length - 1;
    const startedAt = Date.now();

    const baseLog = {
      feature: label,
      model,
      attempt_index: i,
      organization_id: opts.organizationId ?? null,
      user_id: opts.userId ?? null,
    };

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        // Disable thinking — classification/extraction is structured and
        // deterministic; thinking adds latency and tokens without measurable
        // quality gain on tool-forced outputs.
        thinking: { type: "disabled" },
        system: [
          {
            type: "text",
            text: opts.systemPrompt,
            // Cache the system prompt + tool schema prefix. Below minimum
            // cacheable prefix length (1024 on Sonnet 4.6, 4096 on Haiku 4.5)
            // this is a silent no-op; above it, repeated classifications hit
            // cache_read at ~10% of write cost.
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            name: opts.toolName,
            description: opts.toolDescription ?? `Return structured ${opts.toolName} output`,
            input_schema: opts.toolSchema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: opts.toolName },
        messages: [{ role: "user", content: opts.userPrompt }],
      });
    } catch (err) {
      const latency_ms = Date.now() - startedAt;
      // Hard-stops — fallbacks won't help.
      if (err instanceof Anthropic.RateLimitError) {
        logAiCall({
          ...baseLog,
          latency_ms,
          status: "hard_error",
          http_status: 429,
          error_message: "rate limited",
        });
        throw new AiGatewayError(
          "AI is rate-limited right now. Please wait ~30 seconds and try again.",
          429,
        );
      }
      if (err instanceof Anthropic.AuthenticationError) {
        logAiCall({
          ...baseLog,
          latency_ms,
          status: "hard_error",
          http_status: 401,
          error_message: "auth failed",
        });
        throw new AiGatewayError("AI service authentication failed.", 401);
      }
      if (err instanceof Anthropic.BadRequestError) {
        logAiCall({
          ...baseLog,
          latency_ms,
          status: "hard_error",
          http_status: 400,
          error_message: err.message.slice(0, 500),
        });
        throw new AiGatewayError(
          `${label}: AI request rejected — ${err.message.slice(0, 200)}`,
          400,
        );
      }
      // Treat InternalServerError / overloaded / connection blip as retryable.
      const reason =
        err instanceof Anthropic.APIError
          ? `HTTP ${err.status}: ${err.message.slice(0, 200)}`
          : err instanceof Error
            ? err.message
            : "unknown error";
      lastReason = reason;
      console.warn(`[${label}] request failed on ${model}:`, reason);
      logAiCall({
        ...baseLog,
        latency_ms,
        status: isLast ? "error" : "fallback",
        http_status: err instanceof Anthropic.APIError ? err.status : null,
        error_message: reason,
      });
      if (isLast) break;
      continue;
    }

    const toolUseBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolUseBlock) {
      lastReason = "no tool_use block returned";
      console.warn(`[${label}] no tool_use from ${model}, stop_reason=${response.stop_reason}`);
      logAiCall({
        ...baseLog,
        latency_ms: Date.now() - startedAt,
        status: isLast ? "error" : "fallback",
        http_status: 200,
        error_message: `${lastReason} (stop_reason=${response.stop_reason})`,
      });
      if (isLast) break;
      continue;
    }

    // tool_use.input is already parsed JSON (Anthropic does the JSON.parse).
    try {
      const result = toolUseBlock.input as T;
      logAiCall({
        ...baseLog,
        latency_ms: Date.now() - startedAt,
        status: "success",
        http_status: 200,
        metadata: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
        },
      });
      return result;
    } catch (err) {
      lastReason = `malformed tool input: ${err instanceof Error ? err.message : "parse error"}`;
      console.warn(`[${label}] tool input parse failed on ${model}:`, lastReason);
      logAiCall({
        ...baseLog,
        latency_ms: Date.now() - startedAt,
        status: isLast ? "error" : "fallback",
        http_status: 200,
        error_message: lastReason,
      });
      if (isLast) break;
      continue;
    }
  }

  throw new AiGatewayError(
    `${label}: AI failed after trying ${opts.models.length} model${opts.models.length > 1 ? "s" : ""}. ${lastReason ?? "Unknown reason"}. Please try again in a moment.`,
  );
}

/**
 * Default fallback chain. Sonnet 4.6 leads on quality (sales decisions,
 * classification, advisor); Haiku 4.5 catches when Sonnet is rate-limited
 * or down. Set per-feature when a different mix is warranted.
 */
export const DEFAULT_TEXT_MODELS = ["claude-sonnet-4-6", "claude-haiku-4-5"];
