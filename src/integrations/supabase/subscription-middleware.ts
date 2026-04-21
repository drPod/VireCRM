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
    // missing/permissive RLS. We still scope strictly by user_id.
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("status, environment, current_period_end")
      .eq("user_id", userId)
      .in("status", ACTIVE_STATUSES as unknown as string[])
      .order("created_at", { ascending: false });

    if (error) {
      // Fail closed — if we can't verify entitlement, deny access. This is
      // safer than letting through on transient DB hiccups.
      throw new Response(
        JSON.stringify({ error: "Subscription check failed" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const now = Date.now();
    const hasActive = (data ?? []).some((row) => {
      if (!row.current_period_end) return true; // manual/comped or no expiry
      return new Date(row.current_period_end).getTime() > now;
    });

    if (!hasActive) {
      throw new Response(
        JSON.stringify({
          error: "Subscription required",
          code: "SUBSCRIPTION_REQUIRED",
          message:
            "An active subscription is required to use this feature. Please visit /billing.",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    return next();
  });
