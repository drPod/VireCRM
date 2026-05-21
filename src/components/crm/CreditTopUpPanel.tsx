import { useEffect, useRef } from "react";
import { Coins, Download } from "lucide-react";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { toast } from "sonner";
import { CREDIT_PACKS } from "@/lib/credit-packs";
import { useCreditBalance } from "@/hooks/useCreditBalance";
import { CreditPackCard } from "./CreditPackCard";
import { AutoRechargePanel } from "./AutoRechargePanel";
import { LowBalancePanel, callLowBalanceNotifyEndpoint } from "./LowBalancePanel";

// Re-export for CreditLedgerTimeline (and any other consumer).
export { CREDIT_PACKS } from "@/lib/credit-packs";

interface CreditTopUpPanelProps {
  organizationId: string;
  userId?: string | null;
  customerEmail?: string | null;
  /** Hidden entirely when the org has unlimited credits. */
  unlimited?: boolean;
}

export function CreditTopUpPanel({
  organizationId,
  userId,
  customerEmail,
  unlimited,
}: CreditTopUpPanelProps) {
  const { openCheckout, CheckoutDialog } = useStripeCheckout();
  const {
    loading,
    balance,
    auto,
    setAuto,
    lowBalance,
    setLowBalance,
    hasPaymentMethod,
    savedCardLast4,
  } = useCreditBalance({ organizationId, skip: unlimited });

  const lastNotifyCheckRef = useRef<number>(0);

  const handleBuy = (priceId: string) => {
    if (!userId) {
      toast.error("Please sign in to buy credits");
      return;
    }
    openCheckout({
      priceId,
      userId,
      organizationId,
      customerEmail: customerEmail ?? undefined,
      returnUrl: `${window.location.origin}/dashboard?credits=success&session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  // Auto-evaluate after balance loads (debounced — once per minute per mount).
  useEffect(() => {
    if (loading || unlimited || !balance) return;
    if (!lowBalance.enabled) return;
    if (balance.total >= lowBalance.threshold) return;
    const now = Date.now();
    if (now - lastNotifyCheckRef.current < 60_000) return;
    lastNotifyCheckRef.current = now;
    callLowBalanceNotifyEndpoint(organizationId);
  }, [loading, unlimited, balance, lowBalance.enabled, lowBalance.threshold, organizationId]);

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
            <CreditPackCard key={pack.key} pack={pack} onBuy={handleBuy} />
          ))}
        </div>

        <AutoRechargePanel
          organizationId={organizationId}
          auto={auto}
          setAuto={setAuto}
          hasPaymentMethod={hasPaymentMethod}
          savedCardLast4={savedCardLast4}
        />

        <LowBalancePanel
          organizationId={organizationId}
          lowBalance={lowBalance}
          setLowBalance={setLowBalance}
          balance={balance}
        />

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
