import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  type StripeEnv,
  createStripeClient,
  corsHeaders,
} from "../_shared/stripe.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const {
      priceId,
      quantity,
      customerEmail,
      userId,
      returnUrl,
      environment,
      attributedResellerId,
      resellerPlanId,
    } = await req.json();

    if (
      !priceId ||
      typeof priceId !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(priceId)
    ) {
      return new Response(JSON.stringify({ error: "Invalid priceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Ensure the launch promo coupon exists (25% off, forever for subscriptions).
    const PROMO_COUPON_ID = "launch25";
    try {
      await stripe.coupons.retrieve(PROMO_COUPON_ID);
    } catch {
      await stripe.coupons.create({
        id: PROMO_COUPON_ID,
        percent_off: 25,
        duration: "forever",
        name: "Launch promo — 25% off",
      });
    }

    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) {
      return new Response(JSON.stringify({ error: "Price not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const metadata: Record<string, string> = {};
    if (userId) metadata.userId = userId;
    if (attributedResellerId) metadata.attributedResellerId = attributedResellerId;
    if (resellerPlanId) metadata.resellerPlanId = resellerPlanId;

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded",
      discounts: [{ coupon: PROMO_COUPON_ID }],
      return_url:
        returnUrl ||
        `${req.headers.get("origin")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(customerEmail && { customer_email: customerEmail }),
      ...(Object.keys(metadata).length > 0 && {
        metadata,
        ...(isRecurring && { subscription_data: { metadata } }),
      }),
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
