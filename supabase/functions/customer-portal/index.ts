import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, createStripeClient, buildCorsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { returnUrl, environment } = await req.json();
    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .eq("environment", env)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          error: "No active subscription on file",
          code: "no_active_subscription",
          action: { label: "Start subscription", href: "/billing" },
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      ...(returnUrl && { return_url: returnUrl }),
    });

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message, code: "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
