import { useEffect, useState, useCallback } from "react";
import { Coins, Sparkles, Zap, Loader2, Check, CreditCard, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type CreditPack = {
  key: string;
  label: string;
  credits: number;
  priceCents: number;
  highlight?: boolean;
};

export const CREDIT_PACKS: CreditPack[] = [
  { key: "credit_pack_small_onetime", label: "Starter", credits: 100, priceCents: 1500 },
  { key: "credit_pack_medium_onetime", label: "Growth", credits: 500, priceCents: 6000 },
  { key: "credit_pack_large_onetime", label: "Pro", credits: 2000, priceCents: 20000, highlight: true },
  { key: "credit_pack_bulk_onetime", label: "Bulk", credits: 10000, priceCents: 80000 },
];

interface CreditTopUpPanelProps {
  organizationId: string;
  userId?: string | null;
  customerEmail?: string | null;
  /** Hidden entirely when the org has unlimited credits. */
  unlimited?: boolean;
}

interface PackBalance {
  total: number;
  packs: Array<{
    id: string;
    pack_key: string;
    credits_remaining: number;
    credits_total: number;
    expires_at: string;
  }>;
}

interface AutoRechargeSettings {
  enabled: boolean;
  pack_key: string;
  threshold_pct: number;
}

const DEFAULT_AUTO_PACK = "credit_pack_medium_onetime";

function formatPrice(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function perCredit(cents: number, credits: number) {
  return `$${(cents / 100 / credits).toFixed(3)}/credit`;
}

export function CreditTopUpPanel({
  organizationId,
  userId,
  customerEmail,
  unlimited,
}: CreditTopUpPanelProps) {
  const { openCheckout, CheckoutDialog } = useStripeCheckout();
  const [balance, setBalance] = useState<PackBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState<AutoRechargeSettings>({
    enabled: false,
    pack_key: DEFAULT_AUTO_PACK,
    threshold_pct: 20,
  });
  const [savingAuto, setSavingAuto] = useState(false);

  const loadBalance = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data: packs } = await supabase
      .from("credit_packs")
      .select("id, pack_key, credits_remaining, credits_total, expires_at")
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
      .select("auto_recharge_enabled, auto_recharge_pack_key, auto_recharge_threshold_pct")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (settings) {
      setAuto({
        enabled: settings.auto_recharge_enabled ?? false,
        pack_key: settings.auto_recharge_pack_key ?? DEFAULT_AUTO_PACK,
        threshold_pct: settings.auto_recharge_threshold_pct ?? 20,
      });
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (unlimited) {
      setLoading(false);
      return;
    }
    loadBalance();
  }, [loadBalance, unlimited]);

  const handleBuy = (priceId: string) => {
    if (!userId) {
      toast.error("Please sign in to buy credits");
      return;
    }
    openCheckout({
      mode: "price",
      priceId,
      userId,
      organizationId,
      customerEmail: customerEmail ?? undefined,
      returnUrl: `${window.location.origin}/dashboard?credits=success&session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  const persistAuto = async (next: AutoRechargeSettings) => {
    setSavingAuto(true);
    const { error } = await supabase.from("org_credit_settings").upsert(
      {
        organization_id: organizationId,
        auto_recharge_enabled: next.enabled,
        auto_recharge_pack_key: next.pack_key,
        auto_recharge_threshold_pct: next.threshold_pct,
      },
      { onConflict: "organization_id" },
    );
    setSavingAuto(false);
    if (error) {
      toast.error("Could not save auto-recharge settings");
    } else {
      toast.success(
        next.enabled
          ? "Auto-recharge enabled"
          : "Auto-recharge disabled",
      );
      setAuto(next);
    }
  };

  if (unlimited) return null;

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Buy more credits</h3>
              <p className="text-xs text-muted-foreground">
                One-time top-ups · used after monthly quota · expire in 12 months
              </p>
            </div>
          </div>
          {!loading && balance && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Pack balance</p>
              <p className="text-sm font-semibold text-foreground">
                {balance.total.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.key}
              type="button"
              onClick={() => handleBuy(pack.key)}
              className={`group relative flex flex-col items-start rounded-lg border p-3 text-left transition hover:border-primary hover:bg-primary/5 ${
                pack.highlight
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-background"
              }`}
            >
              {pack.highlight && (
                <span className="absolute -top-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  <Sparkles className="h-2.5 w-2.5" />
                  Best
                </span>
              )}
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Zap className="h-3 w-3" />
                {pack.label}
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {pack.credits.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">credits</div>
              <div className="mt-2 text-sm font-semibold text-foreground">
                {formatPrice(pack.priceCents)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {perCredit(pack.priceCents, pack.credits)}
              </div>
            </button>
          ))}
        </div>

        {/* Auto-recharge */}
        <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">Auto-recharge</p>
                {savingAuto && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically buy a pack when remaining credits drop below{" "}
                {auto.threshold_pct}%.
              </p>
            </div>
            <Switch
              checked={auto.enabled}
              onCheckedChange={(checked) => persistAuto({ ...auto, enabled: checked })}
              disabled={savingAuto}
            />
          </div>

          {auto.enabled && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Auto-buy pack
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CREDIT_PACKS.map((pack) => {
                  const active = auto.pack_key === pack.key;
                  return (
                    <button
                      key={pack.key}
                      type="button"
                      disabled={savingAuto}
                      onClick={() => persistAuto({ ...auto, pack_key: pack.key })}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      {pack.credits.toLocaleString()} · {formatPrice(pack.priceCents)}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                You&apos;ll be charged on the card from your last successful purchase.
                Manage your card via Billing.
              </p>
            </div>
          )}
        </div>

        {!loading && balance && balance.packs.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Active packs</p>
            {balance.packs.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>
                  {p.credits_remaining.toLocaleString()} / {p.credits_total.toLocaleString()}{" "}
                  · expires {new Date(p.expires_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {CheckoutDialog}
    </>
  );
}
