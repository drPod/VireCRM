import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, buildCorsHeaders, safeErrorResponse } from "../_shared/stripe.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    // --- AuthN ---
    // verify_jwt=false in config.toml so we extract the bearer in-function
    // and resolve the caller via supabase.auth.getUser (mirrors
    // verify-checkout-session). This prevents anonymous callers from
    // stamping arbitrary userId / organizationId onto session metadata.
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

    // --- AuthZ ---
    // If the caller passes a userId, it must match the authed user.
    if (userId && userId !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden: userId mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // If the caller passes an organizationId, verify membership via the
    // existing helper. Uses service-role to bypass RLS on the check itself.
    if (organizationId) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { data: belongs, error: belongsErr } = await adminClient.rpc("user_belongs_to_org", {
        p_user_id: callerId,
        p_org_id: organizationId,
      });
      if (belongsErr || !belongs) {
        return new Response(JSON.stringify({ error: "Forbidden: not a member of organization" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

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
    return safeErrorResponse(error, 500, corsHeaders);
  }
});
