import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  buildCorsHeaders,
  createStripeClient,
  safeErrorResponse,
} from "../_shared/stripe.ts";

/**
 * Verify a Stripe Checkout Session and return the resolved plan + subscription
 * state. Auth-gated: caller must be signed in AND must be the user the
 * session was created for (session.metadata.userId).
 */
serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }
  try {
    // --- AuthN ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { sessionId, environment } = await req.json();
    if (!sessionId || typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return new Response(JSON.stringify({ error: "Invalid sessionId" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const env = (environment === "live" ? "live" : "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "subscription.items.data.price", "line_items.data.price"],
    });

    // --- AuthZ: caller must own the session ---
    const sessionUserId = session.metadata?.userId;
    if (sessionUserId && sessionUserId !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // deno-lint-ignore no-explicit-any
    const sub = session.subscription as any;
    const item = sub?.items?.data?.[0];
    const stripePrice = item?.price ?? session.line_items?.data?.[0]?.price;
    const planLookupKey =
      stripePrice?.metadata?.lovable_external_id ||
      stripePrice?.lookup_key ||
      stripePrice?.id ||
      null;

    const periodStart = item?.current_period_start ?? sub?.current_period_start ?? null;
    const periodEnd = item?.current_period_end ?? sub?.current_period_end ?? null;

    return new Response(
      JSON.stringify({
        environment: env,
        session: {
          id: session.id,
          status: session.status,
          payment_status: session.payment_status,
          mode: session.mode,
          amount_total: session.amount_total,
          currency: session.currency,
          customer_email: session.customer_email || session.customer_details?.email || null,
          created: session.created,
        },
        subscription: sub
          ? {
              id: sub.id,
              status: sub.status,
              cancel_at_period_end: sub.cancel_at_period_end ?? false,
              current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
              current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            }
          : null,
        plan: stripePrice
          ? {
              lookup_key: planLookupKey,
              amount: stripePrice.unit_amount,
              currency: stripePrice.currency,
              interval: stripePrice.recurring?.interval ?? null,
            }
          : null,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return safeErrorResponse(error, 500, cors);
  }
});
