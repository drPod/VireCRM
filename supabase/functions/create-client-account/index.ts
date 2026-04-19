import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/stripe.ts";

/**
 * Reseller-side admin operation: create a child organization + user under
 * the calling reseller. Optionally attach a reseller_plan that the reseller
 * will charge the client externally (or via Stripe later via the checkout
 * link). Does NOT touch Stripe directly — billing happens through the
 * customer portal / reseller checkout flows.
 */

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers
      .get("authorization")
      ?.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(authHeader);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm caller is a reseller owner
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, organizations:organization_id(is_reseller)")
      .eq("user_id", user.id)
      .maybeSingle();

    const callerOrgId = callerProfile?.organization_id as string | undefined;
    const isReseller = (
      callerProfile?.organizations as { is_reseller?: boolean } | null
    )?.is_reseller;

    if (!callerOrgId || !isReseller) {
      return new Response(
        JSON.stringify({ error: "Caller is not a reseller owner" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", callerOrgId)
      .maybeSingle();
    if (roleRow?.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Owner role required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { email, password, companyName, fullName, resellerPlanId } =
      await req.json();

    if (!email || !password || !companyName) {
      return new Response(
        JSON.stringify({ error: "email, password, companyName required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create user (auto-confirm so they can log in immediately)
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || companyName },
      });
    if (createErr || !created.user) {
      return new Response(
        JSON.stringify({
          error: createErr?.message || "Failed to create user",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const newUserId = created.user.id;

    // The handle_new_user trigger created an org for them — reparent it to
    // the reseller and update its name + brand to the company name.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", newUserId)
      .single();

    const childOrgId = profile?.organization_id;
    if (!childOrgId) {
      return new Response(
        JSON.stringify({ error: "Auto-created org not found" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await supabaseAdmin
      .from("organizations")
      .update({
        name: companyName,
        brand_name: companyName,
        parent_organization_id: callerOrgId,
        plan: "starter",
      })
      .eq("id", childOrgId);

    // Optionally seed a manual subscription row tied to the reseller plan.
    // This represents an externally-billed engagement; Stripe webhooks will
    // upsert real subscriptions if the client later goes through checkout.
    if (resellerPlanId) {
      const { data: plan } = await supabaseAdmin
        .from("reseller_plans")
        .select("id, base_price_id")
        .eq("id", resellerPlanId)
        .eq("reseller_id", callerOrgId)
        .maybeSingle();

      if (plan) {
        await supabaseAdmin.from("subscriptions").insert({
          user_id: newUserId,
          product_id: plan.base_price_id,
          price_id: plan.base_price_id,
          status: "active",
          environment: "manual",
          attributed_reseller_id: callerOrgId,
          reseller_plan_id: plan.id,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUserId,
        organization_id: childOrgId,
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
