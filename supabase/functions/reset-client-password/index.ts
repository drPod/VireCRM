// Reseller-owner-only: resets the password of an owner user in a child client org.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

    const clientOrgId = String(body.clientOrgId ?? "").trim();
    const newPassword = String(body.newPassword ?? "");

    if (!clientOrgId) return json({ error: "clientOrgId required" }, 400);
    if (newPassword.length < 8 || newPassword.length > 72) {
      return json({ error: "Password must be 8–72 characters" }, 400);
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
      .select("id, is_reseller")
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

    if (!ownerCheck) return json({ error: "Owner role required" }, 403);

    // 4. Verify the target client org belongs to this reseller
    const { data: clientOrg } = await admin
      .from("organizations")
      .select("id, parent_organization_id, name, brand_name")
      .eq("id", clientOrgId)
      .maybeSingle();

    if (!clientOrg || clientOrg.parent_organization_id !== callerOrg.id) {
      return json({ error: "Client not found under your account" }, 404);
    }

    // 5. Find the owner of the client org
    const { data: clientOwnerRole } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("organization_id", clientOrgId)
      .eq("role", "owner")
      .maybeSingle();

    if (!clientOwnerRole?.user_id) {
      return json({ error: "No owner account found for this client" }, 404);
    }

    // 6. Get email + reset password
    const { data: targetUser, error: getUserErr } = await admin.auth.admin.getUserById(
      clientOwnerRole.user_id,
    );

    if (getUserErr || !targetUser.user) {
      return json({ error: "Target user not found" }, 404);
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(clientOwnerRole.user_id, {
      password: newPassword,
    });

    if (updateErr) {
      return json({ error: updateErr.message }, 400);
    }

    return json({
      success: true,
      email: targetUser.user.email,
      client_name: clientOrg.brand_name || clientOrg.name,
      login_url: `${new URL(req.url).origin.replace(/\/+$/, "")}`,
    });
  } catch (err) {
    console.error("reset-client-password error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
