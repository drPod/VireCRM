// Platform-admin-only: lists all active manual subscriptions with user emails.
// Joins subscriptions (environment='manual', status='active') with auth.users
// to surface who currently has comped access.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const FALLBACK_ADMINS = ["solidsnake4ks@gmail.com"];

function getAdminEmails(): string[] {
  const raw = Deno.env.get("PLATFORM_ADMIN_EMAILS") ?? "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : FALLBACK_ADMINS.map((e) => e.toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate caller
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Invalid session" }, 401);

    const callerEmail = userRes.user.email?.toLowerCase() ?? "";
    if (!getAdminEmails().includes(callerEmail)) {
      return json({ error: "Forbidden — platform admin only" }, 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch active manual subs
    const { data: subs, error: subsErr } = await admin
      .from("subscriptions")
      .select("id, user_id, product_id, status, created_at, current_period_end")
      .eq("environment", "manual")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (subsErr) return json({ error: `Subs query failed: ${subsErr.message}` }, 500);
    if (!subs || subs.length === 0) return json({ subscriptions: [] });

    // Build email lookup by paginating admin.listUsers (cap ~20k users)
    const emailById = new Map<string, string>();
    let page = 1;
    const perPage = 1000;
    while (page <= 20) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) return json({ error: `User lookup failed: ${error.message}` }, 500);
      for (const u of data.users) emailById.set(u.id, u.email ?? "");
      if (data.users.length < perPage) break;
      page += 1;
    }

    const enriched = subs.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      email: emailById.get(s.user_id) ?? "(unknown)",
      plan: s.product_id,
      granted_at: s.created_at,
      expires_at: s.current_period_end,
    }));

    return json({ subscriptions: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
