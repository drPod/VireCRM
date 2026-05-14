import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, createStripeClient, corsHeaders } from "../_shared/stripe.ts";

/**
 * Verify a Stripe Checkout Session and return the resolved plan + subscription
 * state straight from Stripe (not the local DB). Used by the live status page
 * so users can confirm payment landed even before our webhook upserts the row.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const { sessionId, environment } = await req.json();
    if (!sessionId || typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return new Response(JSON.stringify({ error: "Invalid sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const env = (environment === "live" ? "live" : "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "subscription.items.data.price", "line_items.data.price"],
    });

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
          status: session.status, // 'open' | 'complete' | 'expired'
          payment_status: session.payment_status, // 'paid' | 'unpaid' | 'no_payment_required'
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
