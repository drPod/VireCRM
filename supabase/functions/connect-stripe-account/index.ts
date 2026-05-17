// Creates or refreshes a Stripe Connect onboarding link for the caller's org.
// Returns { url, accountId, charges_enabled, payouts_enabled, details_submitted }.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, buildCorsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    const token = auth?.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const env: StripeEnv = body.environment === "live" ? "live" : "sandbox";
    const returnUrl: string = body.returnUrl || "https://example.com/settings";
    const refreshUrl: string = body.refreshUrl || returnUrl;

    // Resolve org and confirm caller is owner
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.organization_id) throw new Error("No organization");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id);
    const isOwner = (roles || []).some((r) => r.role === "owner");
    if (!isOwner) throw new Error("Only owners can connect Stripe");

    const stripe = createStripeClient(env);

    // Find or create Connect account
    const { data: existing } = await supabase
      .from("client_stripe_accounts")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    let accountId = existing?.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { organization_id: profile.organization_id, user_id: user.id },
      });
      accountId = account.id;
      await supabase.from("client_stripe_accounts").insert({
        organization_id: profile.organization_id,
        stripe_account_id: account.id,
        environment: env,
        email: user.email,
        country: account.country,
        default_currency: account.default_currency,
        created_by: user.id,
      });
    }

    // Refresh status from Stripe
    const refreshed = await stripe.accounts.retrieve(accountId);
    await supabase
      .from("client_stripe_accounts")
      .update({
        charges_enabled: refreshed.charges_enabled,
        payouts_enabled: refreshed.payouts_enabled,
        details_submitted: refreshed.details_submitted,
        country: refreshed.country,
        default_currency: refreshed.default_currency,
      })
      .eq("organization_id", profile.organization_id);

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({
        url: link.url,
        accountId,
        charges_enabled: refreshed.charges_enabled,
        payouts_enabled: refreshed.payouts_enabled,
        details_submitted: refreshed.details_submitted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("connect-stripe-account error:", err);
    const raw = (err as { raw?: { message?: string } })?.raw?.message;
    const message = raw || (err as Error).message || "Failed";

    // Stripe Connect must be enabled on the platform account before we can
    // create connected accounts. Detect this exact case and return an
    // actionable hint instead of the raw Stripe blob.
    const needsConnectSignup = /signed up for Connect/i.test(message);
    if (needsConnectSignup) {
      return new Response(
        JSON.stringify({
          error:
            "Stripe Connect isn't enabled on your platform account yet. Open https://dashboard.stripe.com/connect, click 'Get started', complete the platform profile, then try again.",
          code: "stripe_connect_not_enabled",
          actionUrl: "https://dashboard.stripe.com/connect",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
