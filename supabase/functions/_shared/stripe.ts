import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

export type StripeEnv = "sandbox" | "live";

export function getConnectionApiKey(env: StripeEnv): string {
  const key =
    env === "sandbox"
      ? Deno.env.get("STRIPE_SANDBOX_API_KEY")
      : Deno.env.get("STRIPE_LIVE_API_KEY");
  if (!key) throw new Error(`STRIPE_${env.toUpperCase()}_API_KEY is not configured`);
  return key;
}

/**
 * Phase 1 migration: previously wrapped Stripe in the Lovable connector
 * gateway (`connector-gateway.lovable.dev/stripe`) which routed every API
 * call through Lovable's proxy. With Lovable cut, Stripe talks directly to
 * `api.stripe.com` using the workspace's own `STRIPE_{SANDBOX,LIVE}_API_KEY`
 * — same key the gateway was forwarding via `X-Connection-Api-Key`.
 */
export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  return new Stripe(connectionApiKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * Verify a Stripe webhook using HMAC-SHA256. Does not depend on the Stripe SDK
 * (so it does not need the gateway proxy).
 */
export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret =
    env === "sandbox"
      ? Deno.env.get("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : Deno.env.get("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!secret) throw new Error("Webhook secret is not configured");
  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) {
    throw new Error("Invalid signature format");
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));

  if (!v1Signatures.includes(expected)) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(body);
}

// Allowed origins for browser-initiated calls. Server-to-server callers
// (no Origin header) are unaffected.
const ALLOWED_ORIGIN_SUFFIXES = [
  ".lovable.app",
  ".majix.ai",
  "majix.ai",
  ".majix.ai",
  "majix.ai",
  ".vercel.app",
  "vercel.app",
  "localhost",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_ORIGIN_SUFFIXES.some((s) =>
      s.startsWith(".") ? host.endsWith(s) : host === s || host.startsWith(`${s}:`),
    );
  } catch {
    return false;
  }
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : "https://genesisxsx.lovable.app",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

/**
 * Sanitize an error for client response. Logs full details server-side
 * and returns a generic message to avoid leaking Stripe internals.
 */
export function safeErrorResponse(error: unknown, status = 500, headers: Record<string, string> = {}): Response {
  console.error("[stripe-edge-fn]", error);
  return new Response(
    JSON.stringify({ error: "An unexpected error occurred" }),
    { status, headers: { ...headers, "Content-Type": "application/json" } },
  );
}
