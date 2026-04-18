import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  paddle_subscription_id: string;
  paddle_customer_id: string;
  product_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  attributed_reseller_id: string | null;
  reseller_plan_id: string | null;
};

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

// In test mode (preview) we count "sandbox" + "manual" subs.
// In live mode (published) we count "live" + "manual" subs.
// "manual" = reseller-provisioned client (lifetime / paid externally), always entitled.
function getEnvForMode(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const GRACE_STATUSES = new Set(["past_due"]);

export interface SubscriptionState {
  loading: boolean;
  subscription: SubscriptionRow | null;
  /** True if the user has a usable subscription right now (active/trialing, or manual). */
  hasAccess: boolean;
  /** True if past_due — show "update payment" warning but keep access for grace period. */
  inGrace: boolean;
  /** True if the row exists but is canceled/paused/expired. */
  isBlocked: boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(userId: string | null | undefined): SubscriptionState {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const env = getEnvForMode();
    // Pull every row for this user, then pick the best (manual > active > others).
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("environment", [env, "manual"])
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as SubscriptionRow[];
    const best =
      rows.find((r) => r.environment === "manual" && r.status === "active") ||
      rows.find((r) => ACTIVE_STATUSES.has(r.status)) ||
      rows.find((r) => GRACE_STATUSES.has(r.status)) ||
      rows[0] ||
      null;

    setSubscription(best);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: react to webhook updates without a refresh.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`sub_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const sub = subscription;
  const periodOk =
    !sub?.current_period_end || new Date(sub.current_period_end) > new Date();
  const isManual = sub?.environment === "manual" && sub.status === "active";
  const hasAccess = !!sub && (isManual || (ACTIVE_STATUSES.has(sub.status) && periodOk));
  const inGrace = !!sub && GRACE_STATUSES.has(sub.status);
  const isBlocked = !!sub && !hasAccess && !inGrace;

  return { loading, subscription, hasAccess, inGrace, isBlocked, refresh: load };
}

/** Resolve the current payments environment string used in DB rows. */
export function getPaymentsEnv(): "sandbox" | "live" {
  return getEnvForMode();
}
