// Platform-admin-only edge function to grant / revoke / list custom feature
// flags on any organization. Mirrors the auth pattern of grant-manual-subscription.
//
// Actions (POST body):
//   { action: "list", organizationId }
//   { action: "list_orgs", search? }
//   { action: "grant", organizationId, featureKey, config?, notes?, expiresAt? }
//   { action: "revoke", organizationId, featureKey }
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
    if (userErr || !userRes?.user) return json({ error: "Invalid session" }, 401);

    const callerEmail = userRes.user.email?.toLowerCase() ?? "";
    const callerId = userRes.user.id;

    // 2. Authorize — must be a platform admin
    const admins = getAdminEmails();
    if (!admins.includes(callerEmail)) {
      return json({ error: "Forbidden — platform admin only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "list_orgs") {
      const search = String(body.search ?? "").trim();
      let query = admin
        .from("organizations")
        .select("id, name, slug, brand_name, plan")
        .order("name", { ascending: true })
        .limit(100);
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,slug.ilike.%${search}%,brand_name.ilike.%${search}%`,
        );
      }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ organizations: data ?? [] });
    }

    if (action === "list") {
      const orgId = String(body.organizationId ?? "");
      if (!orgId) return json({ error: "organizationId required" }, 400);
      const { data, error } = await admin
        .from("org_features")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ features: data ?? [] });
    }

    if (action === "grant") {
      const orgId = String(body.organizationId ?? "");
      const featureKey = String(body.featureKey ?? "").trim();
      const notes = body.notes ? String(body.notes).trim() : null;
      const config = body.config && typeof body.config === "object" ? body.config : {};
      const expiresAt = body.expiresAt ? String(body.expiresAt) : null;

      if (!orgId || !featureKey) {
        return json({ error: "organizationId and featureKey required" }, 400);
      }

      const { data, error } = await admin
        .from("org_features")
        .upsert(
          {
            organization_id: orgId,
            feature_key: featureKey,
            enabled: true,
            config,
            notes,
            enabled_by: callerId,
            enabled_at: new Date().toISOString(),
            expires_at: expiresAt,
          },
          { onConflict: "organization_id,feature_key" },
        )
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      console.log(`[manage-org-features] ${callerEmail} granted ${featureKey} to org ${orgId}`);
      return json({ success: true, feature: data });
    }

    if (action === "revoke") {
      const orgId = String(body.organizationId ?? "");
      const featureKey = String(body.featureKey ?? "").trim();
      if (!orgId || !featureKey) {
        return json({ error: "organizationId and featureKey required" }, 400);
      }
      const { error } = await admin
        .from("org_features")
        .delete()
        .eq("organization_id", orgId)
        .eq("feature_key", featureKey);
      if (error) return json({ error: error.message }, 500);
      console.log(`[manage-org-features] ${callerEmail} revoked ${featureKey} from org ${orgId}`);
      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
