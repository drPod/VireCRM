/**
 * Shared helpers for AI agent edge functions.
 *
 * Each agent is its own deno function (single responsibility, easy to call
 * from workflow steps or directly). They all share:
 *   - CORS preflight handling
 *   - Auth: caller's JWT must resolve to a user with an organization
 *   - LovableAI gateway call with tool-calling for structured output
 *   - 429/402 passthrough so the client surfaces credit/rate issues
 */
// @ts-expect-error - Deno-only import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Deno is only available at runtime in Supabase functions; types not present here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

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
 * Call the Lovable AI Gateway with forced tool-calling so the response is
 * always structured JSON. Returns the parsed tool args, or throws a Response
 * on rate-limit / credit exhaustion so the caller can return it directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callStructured<T = any>(args: CallAIArgs): Promise<T> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: args.toolName,
            description: args.toolDescription,
            parameters: args.parameters,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: args.toolName } },
    }),
  });

  if (res.status === 429) {
    throw jsonResponse({ error: "AI rate limit exceeded — try again shortly." }, 429);
  }
  if (res.status === 402) {
    throw jsonResponse(
      { error: "AI credits exhausted. Top up in Settings → Workspace → Usage." },
      402,
    );
  }
  if (!res.ok) {
    const text = await res.text();
    console.error("AI gateway error", res.status, text);
    throw new Error(`AI gateway error: ${res.status}`);
  }

  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) {
    throw new Error("AI did not return a tool call");
  }
  return JSON.parse(call.function.arguments) as T;
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
