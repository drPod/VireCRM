import { useEffect, useRef, useState, useCallback } from "react";
import {
  Coins,
  Sparkles,
  Zap,
  Loader2,
  Check,
  CreditCard,
  AlertTriangle,
  Download,
  Bell,
  BellOff,
  Send,
} from "lucide-react";
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
  {
    key: "credit_pack_large_onetime",
    label: "Pro",
    credits: 2000,
    priceCents: 20000,
    highlight: true,
  },
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
    receipt_url: string | null;
    hosted_invoice_url: string | null;
  }>;
}

interface AutoRechargeSettings {
  enabled: boolean;
  pack_key: string;
  threshold_pct: number;
}

interface LowBalanceSettings {
  enabled: boolean;
  threshold: number;
}

const DEFAULT_AUTO_PACK = "credit_pack_medium_onetime";

function formatPrice(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function perCredit(cents: number, credits: number) {
  return `$${(cents / 100 / credits).toFixed(3)}/credit`;
}

function packLabel(key: string): string {
  return CREDIT_PACKS.find((p) => p.key === key)?.label ?? key;
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
  const [savedCardLast4, setSavedCardLast4] = useState<string | null>(null);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [pendingThreshold, setPendingThreshold] = useState<number>(20);
  const [pendingPack, setPendingPack] = useState<string>(DEFAULT_AUTO_PACK);
  const [lowBalance, setLowBalance] = useState<LowBalanceSettings>({
    enabled: true,
    threshold: 50,
  });
  const [thresholdInput, setThresholdInput] = useState<string>("50");
  const [savingLow, setSavingLow] = useState(false);
  const [testingLow, setTestingLow] = useState(false);
  const lastNotifyCheckRef = useRef<number>(0);

  const loadBalance = useCallback(async () => {
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
      const next = {
        enabled: settings.auto_recharge_enabled ?? false,
        pack_key: settings.auto_recharge_pack_key ?? DEFAULT_AUTO_PACK,
        threshold_pct: settings.auto_recharge_threshold_pct ?? 20,
      };
      setAuto(next);
      setPendingThreshold(next.threshold_pct);
      setPendingPack(next.pack_key);
      const pmId = settings.stripe_payment_method_id ?? null;
      setHasPaymentMethod(!!pmId);
      // pmId looks like pm_xxxxxxxxxxxxxxxx — show last 4 chars as a stable hint;
      // the real card brand/last4 would require a Stripe call we surface elsewhere.
      setSavedCardLast4(pmId ? pmId.slice(-4) : null);

      const lb = {
        enabled: settings.low_balance_notify_enabled ?? true,
        threshold: settings.low_balance_threshold ?? 50,
      };
      setLowBalance(lb);
      setThresholdInput(String(lb.threshold));
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
    const prev = auto;
    const enabledChanged = prev.enabled !== next.enabled;
    const thresholdChanged = prev.threshold_pct !== next.threshold_pct;
    const packChanged = prev.pack_key !== next.pack_key;

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
      if (enabledChanged) {
        toast.error(
          next.enabled
            ? "Couldn't enable auto-recharge — please try again"
            : "Couldn't disable auto-recharge — please try again",
        );
      } else if (packChanged) {
        toast.error(`Couldn't switch auto-recharge pack to ${packLabel(next.pack_key)}`);
      } else if (thresholdChanged) {
        toast.error(`Couldn't update threshold to ${next.threshold_pct}%`);
      } else {
        toast.error("Could not save auto-recharge settings");
      }
    } else {
      setAuto(next);
      if (enabledChanged) {
        if (next.enabled) {
          toast.success("Auto-recharge enabled", {
            description: `We'll auto-buy the ${packLabel(next.pack_key)} pack when balance drops below ${next.threshold_pct}% of quota.`,
          });
        } else {
          toast.success("Auto-recharge disabled", {
            description: "Your saved card won't be charged automatically.",
          });
        }
      } else if (packChanged) {
        toast.success(`Auto-recharge pack set to ${packLabel(next.pack_key)}`, {
          description:
            "This pack will be charged the next time your balance falls below the threshold.",
        });
      } else if (thresholdChanged) {
        toast.success(`Threshold updated to ${next.threshold_pct}%`, {
          description: `Auto-recharge will trigger when balance drops below ${next.threshold_pct}% of monthly quota.`,
        });
      } else {
        toast.success("Auto-recharge settings saved");
      }
    }
  };

  const persistLow = async (next: LowBalanceSettings) => {
    setSavingLow(true);
    const { error } = await supabase.from("org_credit_settings").upsert(
      {
        organization_id: organizationId,
        low_balance_notify_enabled: next.enabled,
        low_balance_threshold: next.threshold,
      },
      { onConflict: "organization_id" },
    );
    setSavingLow(false);
    if (error) {
      toast.error("Could not save low-balance alert settings");
    } else {
      setLowBalance(next);
      toast.success(next.enabled ? "Low-balance alerts updated" : "Low-balance alerts disabled");
    }
  };

  const callNotifyEndpoint = async (
    force = false,
  ): Promise<{
    success: boolean;
    notified?: boolean;
    reason?: string;
    queued?: number;
  } | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    try {
      const res = await fetch(`/api/notify-low-balance${force ? "?force=1" : ""}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const sendTestLow = async () => {
    setTestingLow(true);
    const result = await callNotifyEndpoint();
    setTestingLow(false);
    if (!result) {
      toast.error("Could not run low-balance check");
      return;
    }
    if (result.notified) {
      toast.success(`Alert email queued to ${result.queued ?? 1} owner(s)`);
    } else if (result.reason === "above_threshold") {
      toast.info("Balance is above threshold — no alert needed");
    } else if (result.reason === "cooldown") {
      toast.info("An alert was already sent in the last 24h — skipped");
    } else if (result.reason === "disabled") {
      toast.info("Low-balance alerts are turned off");
    } else {
      toast.info("No alert sent");
    }
  };

  // Auto-evaluate after balance loads (debounced — once per minute per mount).
  useEffect(() => {
    if (loading || unlimited || !balance) return;
    if (!lowBalance.enabled) return;
    if (balance.total >= lowBalance.threshold) return;
    const now = Date.now();
    if (now - lastNotifyCheckRef.current < 60_000) return;
    lastNotifyCheckRef.current = now;
    callNotifyEndpoint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, unlimited, balance, lowBalance.enabled, lowBalance.threshold]);

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
                pack.highlight ? "border-primary/60 bg-primary/5" : "border-border bg-background"
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
                {savingAuto && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {auto.enabled && (
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    ON
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {auto.enabled ? (
                  <>
                    Auto-buys the {packLabel(auto.pack_key)} pack when balance drops below{" "}
                    <span className="font-semibold text-foreground">{auto.threshold_pct}%</span> of
                    monthly quota.
                  </>
                ) : (
                  <>
                    Automatically buy a pack when your balance gets low — never run out
                    mid-campaign.
                  </>
                )}
              </p>
            </div>
            <Switch
              checked={auto.enabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  // Open confirm dialog instead of persisting immediately
                  setPendingThreshold(auto.threshold_pct);
                  setPendingPack(auto.pack_key);
                  setConfirmOpen(true);
                } else {
                  setConfirmDisableOpen(true);
                }
              }}
              disabled={savingAuto}
            />
          </div>

          {auto.enabled && (
            <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Trigger threshold</p>
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    {auto.threshold_pct}%
                  </span>
                </div>
                <Slider
                  value={[auto.threshold_pct]}
                  min={5}
                  max={50}
                  step={5}
                  disabled={savingAuto}
                  onValueChange={(v) => setAuto((a) => ({ ...a, threshold_pct: v[0] }))}
                  onValueCommit={(v) => persistAuto({ ...auto, threshold_pct: v[0] })}
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>5%</span>
                  <span>50%</span>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Auto-buy pack</p>
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
              </div>

              <div className="flex items-center gap-2 rounded-md bg-background/60 px-2.5 py-2 text-xs">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                {hasPaymentMethod ? (
                  <span className="text-muted-foreground">
                    Charges saved card{savedCardLast4 ? ` (•••• ${savedCardLast4})` : ""}
                  </span>
                ) : (
                  <span className="text-amber-400">
                    No saved card — first manual purchase will be used for future charges.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Low-balance email alert */}
        <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">Low-balance email alert</p>
                {savingLow && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {lowBalance.enabled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    <Bell className="h-2.5 w-2.5" /> ON
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <BellOff className="h-2.5 w-2.5" /> OFF
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {lowBalance.enabled ? (
                  <>
                    Emails every owner when pack balance drops below{" "}
                    <span className="font-semibold text-foreground">
                      {lowBalance.threshold.toLocaleString()}
                    </span>{" "}
                    credits. Re-sends at most once every 24h.
                  </>
                ) : (
                  <>Get notified by email before you run out of credits.</>
                )}
              </p>
            </div>
            <Switch
              checked={lowBalance.enabled}
              onCheckedChange={(checked) => persistLow({ ...lowBalance, enabled: checked })}
              disabled={savingLow}
            />
          </div>

          {lowBalance.enabled && (
            <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Threshold (credits)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    onBlur={() => {
                      const n = Math.max(0, Math.floor(Number(thresholdInput) || 0));
                      setThresholdInput(String(n));
                      if (n !== lowBalance.threshold) {
                        persistLow({ ...lowBalance, threshold: n });
                      }
                    }}
                    disabled={savingLow}
                    className="h-8 w-32 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[25, 50, 100, 250, 500].map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={savingLow}
                        onClick={() => {
                          setThresholdInput(String(v));
                          persistLow({ ...lowBalance, threshold: v });
                        }}
                        className={`rounded-md border px-2 py-1 text-xs transition ${
                          lowBalance.threshold === v
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                {balance && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Current pack balance:{" "}
                    <span
                      className={`font-semibold ${balance.total < lowBalance.threshold ? "text-amber-400" : "text-foreground"}`}
                    >
                      {balance.total.toLocaleString()}
                    </span>{" "}
                    credits
                    {balance.total < lowBalance.threshold && " — below threshold"}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={sendTestLow}
                disabled={testingLow || savingLow}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
              >
                {testingLow ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Run check now
              </button>
            </div>
          )}
        </div>

        {/* Confirm-enable dialog */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Enable auto-recharge?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>
                    When your balance drops below{" "}
                    <span className="font-semibold text-foreground">{pendingThreshold}%</span> of
                    your monthly quota, we&apos;ll automatically charge your saved card for the{" "}
                    <span className="font-semibold text-foreground">{packLabel(pendingPack)}</span>{" "}
                    pack.
                  </p>

                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Trigger threshold
                        </span>
                        <span className="text-xs font-semibold text-foreground tabular-nums">
                          {pendingThreshold}%
                        </span>
                      </div>
                      <Slider
                        value={[pendingThreshold]}
                        min={5}
                        max={50}
                        step={5}
                        onValueChange={(v) => setPendingThreshold(v[0])}
                      />
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pack</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CREDIT_PACKS.map((pack) => {
                          const active = pendingPack === pack.key;
                          return (
                            <button
                              key={pack.key}
                              type="button"
                              onClick={() => setPendingPack(pack.key)}
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
                    </div>

                    <div className="flex items-center gap-2 rounded-md bg-background/60 px-2.5 py-2 text-xs">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      {hasPaymentMethod ? (
                        <span className="text-muted-foreground">
                          Charges saved card{savedCardLast4 ? ` (•••• ${savedCardLast4})` : ""}
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3" />
                          No saved card yet — auto-recharge activates after your next manual
                          purchase.
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    You can change the threshold, swap the pack, or disable this anytime.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={savingAuto}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={savingAuto}
                onClick={async (e) => {
                  e.preventDefault();
                  await persistAuto({
                    enabled: true,
                    pack_key: pendingPack,
                    threshold_pct: pendingThreshold,
                  });
                  setConfirmOpen(false);
                }}
              >
                {savingAuto ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable auto-recharge"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirm-disable dialog */}
        <AlertDialog open={confirmDisableOpen} onOpenChange={setConfirmDisableOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Turn off auto-recharge?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>
                    Your saved card will no longer be charged automatically when your balance drops
                    below{" "}
                    <span className="font-semibold text-foreground">{auto.threshold_pct}%</span> of
                    your monthly quota.
                  </p>
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      If your balance runs out mid-campaign, outreach and AI actions may pause until
                      you manually buy more credits.
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You can re-enable auto-recharge anytime — your threshold and pack preferences
                    will be remembered.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={savingAuto}>Keep auto-recharge on</AlertDialogCancel>
              <AlertDialogAction
                disabled={savingAuto}
                onClick={async (e) => {
                  e.preventDefault();
                  await persistAuto({ ...auto, enabled: false });
                  setConfirmDisableOpen(false);
                }}
              >
                {savingAuto ? <Loader2 className="h-4 w-4 animate-spin" /> : "Turn off"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!loading && balance && balance.packs.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Active packs</p>
            {balance.packs.map((p) => {
              const url = p.receipt_url ?? p.hosted_invoice_url;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span className="truncate">
                    {p.credits_remaining.toLocaleString()} / {p.credits_total.toLocaleString()} ·
                    expires {new Date(p.expires_at).toLocaleDateString()}
                  </span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium shrink-0"
                    >
                      <Download className="h-3 w-3" />
                      Receipt
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {CheckoutDialog}
    </>
  );
}
