import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, createStripeClient, corsHeaders } from "../_shared/stripe.ts";

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
      organizationId,
    } = await req.json();

    if (!priceId || typeof priceId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid priceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Credit pack top-ups skip the launch promo (one-time top-ups, full price).
    const isCreditPack = priceId.startsWith("credit_pack_");

    // Ensure the launch promo coupon exists (30% off, forever for subscriptions).
    const PROMO_COUPON_ID = "launch30";
    if (!isCreditPack) {
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

    const metadata: Record<string, string> = { priceId };
    if (userId) metadata.userId = userId;
    if (attributedResellerId) metadata.attributedResellerId = attributedResellerId;
    if (resellerPlanId) metadata.resellerPlanId = resellerPlanId;
    if (organizationId) metadata.organizationId = organizationId;

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded",
      ...(!isCreditPack && { discounts: [{ coupon: PROMO_COUPON_ID }] }),
      return_url:
        returnUrl ||
        `${req.headers.get("origin")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(customerEmail && { customer_email: customerEmail }),
      metadata,
      ...(isRecurring && { subscription_data: { metadata } }),
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
