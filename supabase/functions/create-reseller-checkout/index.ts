import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, createStripeClient, buildCorsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/**
 * Creates a Stripe Embedded Checkout session for a reseller plan.
 * Public endpoint (no auth required) — matches /r/:reseller/checkout/:plan flow.
 */
serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    // --- AuthN ---
    // verify_jwt=false in config.toml so we extract the bearer in-function
    // and resolve the caller via supabase.auth.getUser. This prevents
    // anonymous callers from stamping arbitrary userId onto session metadata
    // (which downstream attribution treats as the paying user).
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { resellerSlug, planSlug, customerEmail, userId, returnUrl, environment } =
      await req.json();

    // --- AuthZ: if caller passes userId, it must match the authed user.
    if (userId && userId !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden: userId mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resellerSlug || !planSlug) {
      return new Response(JSON.stringify({ error: "resellerSlug and planSlug required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: planData, error: planErr } = await supabase.rpc("get_reseller_plan_public", {
      p_reseller_slug: resellerSlug,
      p_plan_slug: planSlug,
    });
    if (planErr || !planData) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const plan = planData as {
      plan_id: string;
      reseller_id: string;
      base_price_id: string;
      monthly_price_cents: number;
      currency: string;
      plan_name: string;
    };

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Ensure the launch promo coupon exists (30% off, forever for subscriptions).
    const PROMO_COUPON_ID = "launch30";
    try {
      await stripe.coupons.retrieve(PROMO_COUPON_ID);
    } catch {
      await stripe.coupons.create({
        id: PROMO_COUPON_ID,
        percent_off: 30,
        duration: "forever",
        name: "Launch promo — 30% off",
      });
    }

    // Resolve the reseller's chosen base price (which the reseller marks up
    // by selling at monthly_price_cents to their client). For Stripe MVP we
    // bill the client at the reseller's price using price_data, then the
    // existing payout calculator credits the markup back to the reseller.
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: { name: plan.plan_name },
            unit_amount: plan.monthly_price_cents,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      ui_mode: "embedded",
      discounts: [{ coupon: PROMO_COUPON_ID }],
      return_url:
        returnUrl ||
        `${req.headers.get("origin")}/r/${resellerSlug}/checkout/${planSlug}/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: {
        ...(userId && { userId }),
        attributedResellerId: plan.reseller_id,
        resellerPlanId: plan.plan_id,
      },
      subscription_data: {
        metadata: {
          ...(userId && { userId }),
          attributedResellerId: plan.reseller_id,
          resellerPlanId: plan.plan_id,
        },
      },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
