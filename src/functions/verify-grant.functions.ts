import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/server-fn-auth";

/**
 * Post-signup verification: confirms the signed-in user's organization
 * matches any pending_subscription_grants row for their email, and
 * self-heals (applies plan, reseller flag, quota, feature flags) if not.
 *
 * Idempotent. Safe to call on every login — it no-ops when nothing is
 * missing or when no grant exists for the user's email.
 */
export const verifyAndApplyGrant = createServerFn({ method: "POST" }).handler(
  async () => {
    const { user } = await requireAuthenticatedUser();
    const email = user.email?.toLowerCase();
    if (!email) return { ok: false, reason: "no_email" as const };

    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { ok: false, reason: "service_not_configured" as const };
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Look up grant for this email (consumed or not — we still verify state).
    const { data: grant } = await admin
      .from("pending_subscription_grants")
      .select("*")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!grant) return { ok: true, applied: false, reason: "no_grant" as const };

    // 2. Find the user's organization.
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return { ok: false, reason: "no_org" as const };
    }
    const orgId = profile.organization_id;

    // 3. Check current org state.
    const { data: org } = await admin
      .from("organizations")
      .select("plan, is_reseller, monthly_lead_quota")
      .eq("id", orgId)
      .maybeSingle();

    const orgUpdates: Record<string, unknown> = {};
    if (org?.plan !== grant.plan) orgUpdates.plan = grant.plan;
    if (org?.is_reseller !== grant.is_reseller) orgUpdates.is_reseller = grant.is_reseller;
    if ((org?.monthly_lead_quota ?? 0) < grant.monthly_lead_quota) {
      orgUpdates.monthly_lead_quota = grant.monthly_lead_quota;
    }

    if (Object.keys(orgUpdates).length > 0) {
      await admin.from("organizations").update(orgUpdates).eq("id", orgId);
    }

    // 4. Check feature flags.
    const { data: existingFeatures } = await admin
      .from("org_features")
      .select("feature_key, enabled")
      .eq("organization_id", orgId);

    const enabledKeys = new Set(
      (existingFeatures ?? []).filter((f) => f.enabled).map((f) => f.feature_key),
    );
    const missing = (grant.feature_keys ?? []).filter((k: string) => !enabledKeys.has(k));

    if (missing.length > 0) {
      const rows = missing.map((feature_key: string) => ({
        organization_id: orgId,
        feature_key,
        enabled: true,
        notes: grant.notes ?? "Self-healed via post-signup verification",
      }));
      await admin
        .from("org_features")
        .upsert(rows, { onConflict: "organization_id,feature_key" });
    }

    // 5. Mark grant consumed if not already.
    if (!grant.consumed_at) {
      await admin
        .from("pending_subscription_grants")
        .update({
          consumed_at: new Date().toISOString(),
          consumed_user_id: user.id,
          consumed_org_id: orgId,
        })
        .eq("id", grant.id);
    }

    const healed = Object.keys(orgUpdates).length > 0 || missing.length > 0;

    return {
      ok: true,
      applied: true,
      healed,
      org_updates: orgUpdates,
      missing_features_added: missing,
      total_features: grant.feature_keys?.length ?? 0,
      plan: grant.plan,
      is_reseller: grant.is_reseller,
    };
  },
);
