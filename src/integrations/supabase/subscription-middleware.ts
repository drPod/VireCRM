// Server-side entitlement gate. Layers on top of requireSupabaseAuth and
// blocks server functions from executing for users who don't have an active
// subscription, even if they call the endpoint directly (bypassing the
// React /billing redirect in _app.tsx).
//
// Counts as "active":
//   - environment in ('live','sandbox','manual')
//   - status in ('active','trialing')
//   - current_period_end is null OR in the future
// 'past_due' is intentionally NOT granted access here — UI can still show a
// grace banner, but writes to paid features are blocked server-side.
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";
import { supabaseAdmin } from "./client.server";

const ACTIVE_STATUSES = ["active", "trialing"] as const;

export const requireActiveSubscription = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { userId } = context;

    // Use the service-role admin client so this check can't be bypassed via
    // missing/permissive RLS. We still scope strictly by user_id / org_id.
    //
    // Access is granted when EITHER:
    //   1. The user has their own active subscription, OR
    //   2. Any owner of the user's organization has an active subscription
    //      (so invited team members ride on the inviter's plan).
    const [ownSubResult, profileResult] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("status, environment, current_period_end")
        .eq("user_id", userId)
        .in("status", ACTIVE_STATUSES as unknown as string[])
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("organization_id").eq("user_id", userId).maybeSingle(),
    ]);

    if (ownSubResult.error || profileResult.error) {
      // Fail closed — if we can't verify entitlement, deny access. This is
      // safer than letting through on transient DB hiccups.
      throw new Response(JSON.stringify({ error: "Subscription check failed" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    const isRowActive = (row: { current_period_end: string | null }) =>
      !row.current_period_end || new Date(row.current_period_end).getTime() > now;

    let hasActive = (ownSubResult.data ?? []).some(isRowActive);

    // Fall back to org-level entitlement: any owner of this user's org with
    // an active sub grants access. This is what makes invited members work
    // without paying separately.
    if (!hasActive && profileResult.data?.organization_id) {
      const { data: ownerRoles, error: rolesError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("organization_id", profileResult.data.organization_id)
        .eq("role", "owner");

      if (rolesError) {
        throw new Response(JSON.stringify({ error: "Subscription check failed" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }

      const ownerIds = (ownerRoles ?? []).map((r) => r.user_id).filter(Boolean);
      if (ownerIds.length > 0) {
        const { data: ownerSubs, error: ownerSubsError } = await supabaseAdmin
          .from("subscriptions")
          .select("status, environment, current_period_end, user_id")
          .in("user_id", ownerIds)
          .in("status", ACTIVE_STATUSES as unknown as string[]);

        if (ownerSubsError) {
          throw new Response(JSON.stringify({ error: "Subscription check failed" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        hasActive = (ownerSubs ?? []).some(isRowActive);
      }
    }

    if (!hasActive) {
      throw new Response(
        JSON.stringify({
          error: "Subscription required",
          code: "SUBSCRIPTION_REQUIRED",
          message: "An active subscription is required to use this feature. Please visit /billing.",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    return next();
  });
