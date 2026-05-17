/**
 * Shared helpers for AI agent edge functions.
 *
 * Each agent is its own deno function (single responsibility, easy to call
 * from workflow steps or directly). They all share:
 *   - CORS preflight handling
 *   - Auth: caller's JWT must resolve to a user with an organization
 *   - Anthropic call with forced tool_use for structured output
 *   - 429/402 passthrough so the client surfaces credit/rate issues
 *
 * Phase 1 migration: this previously hit `ai.gateway.lovable.dev` with
 * OpenAI-style `tool_calls`. Now talks to Anthropic directly via the SDK
 * (`npm:@anthropic-ai/sdk`) with native `tool_use` blocks.
 */
// @ts-expect-error - Deno-only npm specifier
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-expect-error - Deno-only npm specifier
import Anthropic from "npm:@anthropic-ai/sdk@0.96.0";

// Deno is only available at runtime in Supabase functions; types not present here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Default model. Sonnet 4.6 — quality for sales decisions (lead scoring,
 * reply classification, follow-up drafting). Override per-call via
 * `args.model` if a feature needs Haiku or Opus.
 */
export const DEFAULT_MODEL = "claude-sonnet-4-6";

/** Budget on per-call output tokens. Tool-forced outputs are bounded by schema. */
const MAX_TOKENS = 4096;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export interface AgentContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  userId: string;
  orgId: string;
  industry: string | null;
}

/**
 * Validate caller, resolve their org, and return admin clients.
 * Returns a Response on failure (caller should `if (ctx instanceof Response) return ctx;`).
 */
export async function authenticate(req: Request): Promise<AgentContext | Response> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return jsonResponse({ error: "Missing Authorization" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) {
    return jsonResponse({ error: "No organization for user" }, 400);
  }

  const { data: org } = await admin
    .from("organizations")
    .select("industry_template")
    .eq("id", profile.organization_id)
    .maybeSingle();

  return {
    admin,
    userId: user.id,
    orgId: profile.organization_id,
    industry: (org?.industry_template as string | null) ?? null,
  };
}

interface CallAIArgs {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: Record<string, any>;
  model?: string;
}

/**
 * Call Anthropic with forced tool_use so the response is always structured
 * JSON. Returns the parsed tool input, or throws a Response on rate-limit /
 * credit exhaustion so the caller can return it directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callStructured<T = any>(args: CallAIArgs): Promise<T> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });

  let response: any;
  try {
    response = await client.messages.create({
      model: args.model ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "disabled" },
      system: [
        {
          type: "text",
          text: args.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: args.toolName,
          description: args.toolDescription,
          input_schema: args.parameters,
        },
      ],
      tool_choice: { type: "tool", name: args.toolName },
      messages: [{ role: "user", content: args.user }],
    });
  } catch (err: any) {
    if (err instanceof Anthropic.RateLimitError) {
      throw jsonResponse({ error: "AI rate limit exceeded — try again shortly." }, 429);
    }
    if (err instanceof Anthropic.AuthenticationError) {
      throw jsonResponse({ error: "AI service authentication failed." }, 401);
    }
    if (err instanceof Anthropic.BadRequestError) {
      throw new Error(`Anthropic 400: ${err.message}`);
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic ${err.status}: ${err.message}`);
    }
    throw err;
  }

  const toolUse = (response.content as any[]).find((b) => b?.type === "tool_use");
  if (!toolUse) {
    throw new Error(`AI did not return a tool_use block (stop_reason=${response.stop_reason})`);
  }
  return toolUse.input as T;
}

/** Wrap a handler with CORS + Response-throw passthrough. */
export function withAgent(
  handler: (req: Request, ctx: AgentContext) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      const ctx = await authenticate(req);
      if (ctx instanceof Response) return ctx;
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof Response) return e;
      console.error("agent fatal", e);
      return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
    }
  };
}
