// Reseller-owner-only: creates a new client auth user + child org + owner role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "client"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    // 2. Parse + validate input
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const companyName = String(body.companyName ?? "").trim();
    const fullName = String(body.fullName ?? "").trim() || email.split("@")[0];
    const resellerPlanId = body.resellerPlanId
      ? String(body.resellerPlanId)
      : null;

    if (!email.includes("@") || email.length > 255) {
      return json({ error: "Invalid email" }, 400);
    }
    if (password.length < 8 || password.length > 72) {
      return json({ error: "Password must be 8–72 characters" }, 400);
    }
    if (!companyName || companyName.length > 100) {
      return json({ error: "Company name required (max 100 chars)" }, 400);
    }

    // 3. Verify caller is a reseller owner
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!callerProfile?.organization_id) {
      return json({ error: "No organization" }, 403);
    }

    const { data: callerOrg } = await admin
      .from("organizations")
      .select("id, is_reseller, slug, brand_name")
      .eq("id", callerProfile.organization_id)
      .single();

    if (!callerOrg?.is_reseller) {
      return json({ error: "Reseller mode required" }, 403);
    }

    const { data: ownerCheck } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", callerOrg.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerCheck) {
      return json({ error: "Owner role required" }, 403);
    }

    // 4. Create auth user (auto-confirmed so they can log in immediately)
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createErr || !created.user) {
      return json(
        { error: createErr?.message || "Failed to create user" },
        400,
      );
    }

    const newUserId = created.user.id;

    // The handle_new_user() trigger will auto-create an org + profile + owner role.
    // We then move them into a child org under this reseller and clean up the auto-org.
    // Wait briefly for trigger to fire, then look up the auto-created org.
    let autoOrgId: string | null = null;
    for (let i = 0; i < 10; i++) {
      const { data } = await admin
        .from("profiles")
        .select("organization_id")
        .eq("user_id", newUserId)
        .maybeSingle();
      if (data?.organization_id) {
        autoOrgId = data.organization_id;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    // 4b. If a reseller plan was provided, validate it belongs to this reseller
    let plan: {
      id: string;
      monthly_price_cents: number;
      base_cost_cents: number;
      currency: string;
      name: string;
    } | null = null;
    if (resellerPlanId) {
      const { data: planRow, error: planErr } = await admin
        .from("reseller_plans")
        .select("id, reseller_id, monthly_price_cents, base_cost_cents, currency, name, is_active")
        .eq("id", resellerPlanId)
        .maybeSingle();
      if (planErr || !planRow || planRow.reseller_id !== callerOrg.id) {
        await admin.auth.admin.deleteUser(newUserId);
        return json({ error: "Invalid plan" }, 400);
      }
      if (!planRow.is_active) {
        await admin.auth.admin.deleteUser(newUserId);
        return json({ error: "Plan is paused" }, 400);
      }
      plan = planRow;
    }

    // 5. Create the child org
    const slug =
      slugify(companyName) + "-" + crypto.randomUUID().slice(0, 8);

    const { data: newOrg, error: orgErr } = await admin
      .from("organizations")
      .insert({
        name: companyName,
        slug,
        brand_name: companyName,
        parent_organization_id: callerOrg.id,
        plan: plan ? plan.name : "starter",
      })
      .select("id")
      .single();

    if (orgErr || !newOrg) {
      // Roll back the auth user
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: orgErr?.message || "Failed to create org" }, 500);
    }

    // 6. Move the user into the child org
    await admin
      .from("profiles")
      .update({ organization_id: newOrg.id, full_name: fullName })
      .eq("user_id", newUserId);

    await admin.from("user_roles").delete().eq("user_id", newUserId);
    await admin.from("user_roles").insert({
      user_id: newUserId,
      organization_id: newOrg.id,
      role: "owner",
    });

    // 6b. If a plan was assigned, record a manual subscription attributed to the reseller.
    // This makes MRR + payouts include offline-onboarded clients alongside Paddle ones.
    if (plan) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      const manualId = `manual_${crypto.randomUUID()}`;
      await admin.from("subscriptions").insert({
        user_id: newUserId,
        paddle_subscription_id: manualId,
        paddle_customer_id: manualId,
        product_id: "manual",
        price_id: "manual",
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        environment: "manual",
        attributed_reseller_id: callerOrg.id,
        reseller_plan_id: plan.id,
      });
    }


    // 7. Clean up the orphan auto-created org
    if (autoOrgId && autoOrgId !== newOrg.id) {
      const { count } = await admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", autoOrgId);
      if ((count ?? 0) === 0) {
        await admin.from("organizations").delete().eq("id", autoOrgId);
      }
    }

    // 8. Schedule a welcome email ~5 minutes after creation. The /hooks/send-pending-welcomes
    //    cron job picks this up and dispatches via the transactional email queue.
    //    Failure here is non-fatal — account creation already succeeded.
    const loginUrl = `${new URL(req.url).origin.replace(/\/+$/, "")}`;
    try {
      await admin.from("pending_welcome_emails").insert({
        user_id: newUserId,
        organization_id: newOrg.id,
        reseller_id: callerOrg.id,
        recipient_email: email,
        full_name: fullName,
        brand_name: callerOrg.brand_name || callerOrg.slug,
        login_url: loginUrl,
        // send_after defaults to now() + 5 minutes
      });
    } catch (welcomeErr) {
      console.error("Failed to schedule welcome email:", welcomeErr);
    }

    return json({
      success: true,
      user_id: newUserId,
      organization_id: newOrg.id,
      email,
      login_url: loginUrl,
    });
  } catch (err) {
    console.error("create-client-account error:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});
