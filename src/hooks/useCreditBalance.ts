import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AUTO_PACK } from "@/lib/credit-packs";
import type {
  AutoRechargeSettings,
  LowBalanceSettings,
  PackBalance,
} from "@/components/crm/credit-top-up.types";

interface UseCreditBalanceArgs {
  organizationId: string;
  /** Skip the load when the org has unlimited credits — the panel is hidden anyway. */
  skip?: boolean;
}

interface UseCreditBalanceResult {
  loading: boolean;
  balance: PackBalance | null;
  auto: AutoRechargeSettings;
  setAuto: React.Dispatch<React.SetStateAction<AutoRechargeSettings>>;
  lowBalance: LowBalanceSettings;
  setLowBalance: React.Dispatch<React.SetStateAction<LowBalanceSettings>>;
  hasPaymentMethod: boolean;
  savedCardLast4: string | null;
  reload: () => Promise<void>;
}

/**
 * Loads the org's active credit packs + credit settings (auto-recharge,
 * low-balance alert, saved card hint) in a single round-trip. Exposes setters
 * for the persist-mutate flows owned by the child panels.
 */
export function useCreditBalance({
  organizationId,
  skip,
}: UseCreditBalanceArgs): UseCreditBalanceResult {
  const [balance, setBalance] = useState<PackBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState<AutoRechargeSettings>({
    enabled: false,
    pack_key: DEFAULT_AUTO_PACK,
    threshold_pct: 20,
  });
  const [savedCardLast4, setSavedCardLast4] = useState<string | null>(null);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [lowBalance, setLowBalance] = useState<LowBalanceSettings>({
    enabled: true,
    threshold: 50,
  });

  const reload = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data: packs } = await supabase
      .from("credit_packs")
      .select(
        "id, pack_key, credits_remaining, credits_total, expires_at, receipt_url, hosted_invoice_url",
      )
      .eq("organization_id", organizationId)
      .gt("credits_remaining", 0)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true });

    const list = (packs ?? []) as PackBalance["packs"];
    setBalance({
      total: list.reduce((sum, p) => sum + p.credits_remaining, 0),
      packs: list,
    });

    const { data: settings } = await supabase
      .from("org_credit_settings")
      .select(
        "auto_recharge_enabled, auto_recharge_pack_key, auto_recharge_threshold_pct, stripe_payment_method_id, low_balance_notify_enabled, low_balance_threshold",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (settings) {
      setAuto({
        enabled: settings.auto_recharge_enabled ?? false,
        pack_key: settings.auto_recharge_pack_key ?? DEFAULT_AUTO_PACK,
        threshold_pct: settings.auto_recharge_threshold_pct ?? 20,
      });
      const pmId = settings.stripe_payment_method_id ?? null;
      setHasPaymentMethod(!!pmId);
      // pmId looks like pm_xxxxxxxxxxxxxxxx — show last 4 chars as a stable hint;
      // the real card brand/last4 would require a Stripe call we surface elsewhere.
      setSavedCardLast4(pmId ? pmId.slice(-4) : null);

      setLowBalance({
        enabled: settings.low_balance_notify_enabled ?? true,
        threshold: settings.low_balance_threshold ?? 50,
      });
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }
    reload();
  }, [reload, skip]);

  return {
    loading,
    balance,
    auto,
    setAuto,
    lowBalance,
    setLowBalance,
    hasPaymentMethod,
    savedCardLast4,
    reload,
  };
}
