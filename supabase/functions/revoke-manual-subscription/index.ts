// Revoke (cancel) all active manual subscriptions for a given email.
// Platform-admin only. Mirrors auth/authorization model of grant-manual-subscription.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const FALLBACK_ADMINS = ["solidsnake4ks@gmail.com"];

function getAdminEmails(): string[] {
  const raw = Deno.env.get("PLATFORM_ADMIN_EMAILS");
  if (!raw) return FALLBACK_ADMINS.map((e) => e.toLowerCase());
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const callerEmail = (userData.user.email ?? "").toLowerCase();
    const admins = getAdminEmails();
    if (!admins.includes(callerEmail)) {
      return json({ error: "Forbidden — platform admin only" }, 403);
    }

    const { email } = (await req.json()) as { email?: string };
    const target = (email ?? "").trim().toLowerCase();
    if (!target.includes("@")) return json({ error: "Valid email required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find the target user by email (paginate up to 20k users).
    let targetUserId: string | null = null;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return json({ error: error.message }, 500);
      const found = data.users.find(
        (u) => (u.email ?? "").toLowerCase() === target,
      );
      if (found) {
        targetUserId = found.id;
        break;
      }
      if (data.users.length < 1000) break;
    }

    if (!targetUserId) return json({ error: `No user found for ${target}` }, 404);

    const { data: updated, error: updErr } = await admin
      .from("subscriptions")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("user_id", targetUserId)
      .eq("environment", "manual")
      .eq("status", "active")
      .select("id");

    if (updErr) return json({ error: updErr.message }, 500);

    return json({
      success: true,
      revoked_count: updated?.length ?? 0,
      email: target,
    });
  } catch (err) {
    console.error("revoke-manual-subscription error:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      500,
    );
  }
});
