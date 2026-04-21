/**
 * Shared helper for calling the Lovable AI Gateway with automatic multi-model
 * fallback. If the primary model fails (transient 5xx, no tool_calls returned,
 * malformed response), the helper transparently retries with the next model
 * in the list. Hard errors (429 rate limit, 402 credits exhausted) short-circuit
 * — fallbacks won't help for those.
 *
 * Usage:
 *   const args = await callAiWithFallback({
 *     toolName: "analyze_business",
 *     models: ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"],
 *     systemPrompt,
 *     userPrompt,
 *     toolSchema: { ...JSON schema for the tool's parameters... },
 *     featureLabel: "AI advisor",
 *   });
 *   // args is the parsed JSON object from tool_calls[0].function.arguments
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface AiGatewayCallOptions {
  /** Name of the tool/function the model should call. */
  toolName: string;
  /** Models to try in order. The first one that returns valid tool_calls wins. */
  models: string[];
  /** System message content. */
  systemPrompt: string;
  /** User message content. */
  userPrompt: string;
  /** JSON schema describing the tool's `parameters` object. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolSchema: Record<string, any>;
  /** Optional human-readable label used only in logs/error messages (e.g. "AI advisor"). */
  featureLabel?: string;
  /** Optional description for the tool — improves model adherence. */
  toolDescription?: string;
}

/**
 * Thrown for terminal failures the user should see directly. The helper has
 * already exhausted fallbacks by the time this is thrown.
 */
export class AiGatewayError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "AiGatewayError";
  }
}

export async function callAiWithFallback<T = unknown>(
  opts: AiGatewayCallOptions,
): Promise<T> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) {
    throw new AiGatewayError("AI service not configured");
  }

  const label = opts.featureLabel ?? opts.toolName;
  let lastReason: string | null = null;

  for (let i = 0; i < opts.models.length; i++) {
    const model = opts.models[i];
    const isLast = i === opts.models.length - 1;

    let response: Response;
    try {
      response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: opts.systemPrompt },
            { role: "user", content: opts.userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: opts.toolName,
                description: opts.toolDescription ?? `Return structured ${opts.toolName} output`,
                parameters: opts.toolSchema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: opts.toolName } },
        }),
      });
    } catch (err) {
      // Network blip — try next model.
      lastReason = err instanceof Error ? err.message : "network error";
      console.warn(`[${label}] gateway request failed on ${model}:`, lastReason);
      if (isLast) break;
      continue;
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[${label}] gateway error (${model})`, response.status, errBody.slice(0, 300));

      // Hard-stop errors — fallbacks won't help and we should surface immediately.
      if (response.status === 429) {
        throw new AiGatewayError("AI is rate-limited right now. Please wait ~30 seconds and try again.", 429);
      }
      if (response.status === 402) {
        throw new AiGatewayError(
          "AI credits exhausted on this workspace. Add credits in Settings → Workspace → Usage.",
          402,
        );
      }
      // 4xx other than the hard-stops are usually request-shape issues — not
      // recoverable by switching models. Throw on the first one.
      if (response.status >= 400 && response.status < 500) {
        throw new AiGatewayError(
          `${label}: AI request rejected (${response.status})${errBody ? ` — ${errBody.slice(0, 200)}` : ""}`,
          response.status,
        );
      }

      lastReason = `HTTP ${response.status}`;
      if (isLast) break;
      continue; // 5xx → try next model
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      lastReason = "non-JSON gateway response";
      console.warn(`[${label}] non-JSON response from ${model}`);
      if (isLast) break;
      continue;
    }

    const toolCallArgs =
      (parsed as {
        choices?: Array<{
          message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
        }>;
      })?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;

    if (!toolCallArgs) {
      lastReason = "no tool_calls returned";
      console.warn(
        `[${label}] no tool_calls from ${model}, snippet:`,
        JSON.stringify(parsed).slice(0, 300),
      );
      if (isLast) break;
      continue;
    }

    try {
      return JSON.parse(toolCallArgs) as T;
    } catch (err) {
      lastReason = `malformed JSON: ${err instanceof Error ? err.message : "parse error"}`;
      console.warn(`[${label}] JSON parse failed on ${model}:`, lastReason);
      if (isLast) break;
      continue;
    }
  }

  throw new AiGatewayError(
    `${label}: AI failed after trying ${opts.models.length} model${opts.models.length > 1 ? "s" : ""}. ${lastReason ?? "Unknown reason"}. Please try again in a moment.`,
  );
}

/** Default fallback chain for general-purpose tool-calling features. */
export const DEFAULT_TEXT_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
];
