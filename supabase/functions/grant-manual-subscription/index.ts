// Platform-admin-only edge function to grant a manual "Enterprise" subscription
// to any user by email. Bypasses Stripe entirely — used for comped accounts,
// internal team members, and white-label clients you've sold offline.
//
// Authorization: caller's email must appear in PLATFORM_ADMIN_EMAILS (comma-
// separated env var). If unset, falls back to a hardcoded allowlist.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/stripe.ts";

function getAdminEmails(): string[] {
  const raw = Deno.env.get("PLATFORM_ADMIN_EMAILS") ?? "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
  if (fromEnv.length === 0) {
    throw new Error("PLATFORM_ADMIN_EMAILS is not configured");
  }
  return fromEnv;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Authenticate caller
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return json({ error: "Invalid session" }, 401);
    }
    const callerEmail = userRes.user.email?.toLowerCase() ?? "";

    // 2. Authorize — must be a platform admin
    const admins = getAdminEmails();
    if (!admins.includes(callerEmail)) {
      return json({ error: "Forbidden — platform admin only" }, 403);
    }

    // 3. Validate input
    const body = await req.json().catch(() => ({}));
    const targetEmail = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const planLabel = String(body.planLabel ?? "manual_enterprise").trim();
    const note = String(body.note ?? "").trim();

    if (!targetEmail || !targetEmail.includes("@")) {
      return json({ error: "Valid email required" }, 400);
    }

    // 4. Look up the auth user by email (paginate through admin.listUsers)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let targetUserId: string | null = null;
    let page = 1;
    const perPage = 1000;
    while (page <= 20) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) return json({ error: `User lookup failed: ${error.message}` }, 500);
      const match = data.users.find((u) => (u.email ?? "").toLowerCase() === targetEmail);
      if (match) {
        targetUserId = match.id;
        break;
      }
      if (data.users.length < perPage) break;
      page += 1;
    }

    if (!targetUserId) {
      return json({ error: `No user found with email ${targetEmail}` }, 404);
    }

    // 5. Check for existing active manual subscription — don't duplicate
    const { data: existing } = await admin
      .from("subscriptions")
      .select("id, status, environment, current_period_end")
      .eq("user_id", targetUserId)
      .eq("environment", "manual")
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return json({
        success: true,
        already_active: true,
        subscription_id: existing.id,
        message: "User already has an active manual subscription",
      });
    }

    // 6. Insert the manual subscription (100-year period = effectively lifetime)
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 100);

    const { data: inserted, error: insertErr } = await admin
      .from("subscriptions")
      .insert({
        user_id: targetUserId,
        product_id: planLabel,
        price_id: planLabel,
        status: "active",
        environment: "manual",
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      })
      .select()
      .single();

    if (insertErr) {
      return json({ error: `Insert failed: ${insertErr.message}` }, 500);
    }

    // 7. Best-effort audit log
    console.log(
      `[grant-manual-subscription] ${callerEmail} granted ${planLabel} to ${targetEmail} (${targetUserId})${note ? ` — note: ${note}` : ""}`,
    );

    return json({
      success: true,
      subscription_id: inserted.id,
      user_id: targetUserId,
      email: targetEmail,
      plan: planLabel,
      expires_at: periodEnd.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
