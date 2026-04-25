import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Infinity as InfinityIcon,
  Sparkles,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Receipt,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { crmTiers, whiteLabelTiers, type PricingTier } from "@/components/marketing/PricingCards";
import { Check, X } from "lucide-react";
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

/**
 * Parse the leading dollar amount from a tier price string.
 * Handles "$97", "$297–$497" (returns the lower bound), "Custom", "$14,000+".
 * Returns null when no numeric price can be inferred (e.g. "Custom").
 */
function parsePriceToNumber(price: string): number | null {
  const match = price.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Estimate prorated charge today when switching from one monthly plan to another
 * partway through a billing cycle. Stripe's actual proration is computed at the
 * moment of the swap; this is a transparent client-side estimate so users aren't
 * surprised by the next invoice.
 *
 * Formula: (newPrice - currentPrice) * (daysRemaining / cycleLength)
 * Returns 0 when downgrading (Stripe issues a credit, no charge today).
 */
function estimateProration(args: {
  currentPrice: number;
  newPrice: number;
  periodStart: string | null;
  periodEnd: string | null;
}): { prorationToday: number; daysRemaining: number; cycleDays: number } | null {
  const { currentPrice, newPrice, periodStart, periodEnd } = args;
  if (!periodStart || !periodEnd) return null;
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const cycleDays = Math.max(1, Math.round((end - start) / 86_400_000));
  const daysRemaining = Math.max(0, Math.round((end - now) / 86_400_000));
  const fraction = daysRemaining / cycleDays;
  const delta = newPrice - currentPrice;
  const prorationToday = delta > 0 ? +(delta * fraction).toFixed(2) : 0;
  return { prorationToday, daysRemaining, cycleDays };
}

function findTierByPriceId(priceId: string): PricingTier | undefined {
  return [...crmTiers, ...whiteLabelTiers].find((t) => t.stripePriceId === priceId);
}

function InlinePlans({
  onSelect,
  currentPriceId,
}: {
  onSelect: (tier: PricingTier) => void;
  currentPriceId?: string;
}) {
  const allTiers = [...crmTiers, ...whiteLabelTiers].filter((t) => t.stripePriceId);
  const currentTier = currentPriceId
    ? allTiers.find((t) => t.stripePriceId === currentPriceId)
    : undefined;
  const currentPrice = currentTier ? parsePriceToNumber(currentTier.price) : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {allTiers.map((tier) => {
        const isCurrent = tier.stripePriceId === currentPriceId;
        const tierPrice = parsePriceToNumber(tier.price);
        // A "downgrade" is any plan priced below the current plan. We block
        // it here because Stripe proration on a downgrade-mid-cycle is
        // confusing (credit applied later, not refunded today). Users can
        // still downgrade through the billing portal if they really want to.
        const isDowngrade =
          !isCurrent &&
          currentPrice !== null &&
          tierPrice !== null &&
          tierPrice < currentPrice;

        return (
          <div
            key={tier.name}
            className={`relative rounded-xl border p-5 flex flex-col ${
              isCurrent
                ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                : tier.highlighted
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card"
            } ${isDowngrade ? "opacity-60" : ""}`}
          >
            {isCurrent && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <Badge
                  variant="default"
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 shadow-sm flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Current
                </Badge>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground">{tier.name}</h3>
              {tier.badge && !isCurrent && (
                <Badge variant="secondary" className="text-[10px]">{tier.badge}</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
            <p className="mt-3 text-xl font-bold text-foreground">
              {tier.price}
              <span className="text-xs font-normal text-muted-foreground">{tier.period}</span>
            </p>
            <ul className="mt-3 space-y-1.5 flex-1">
              {tier.features.slice(0, 5).map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  {f.included ? (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                  )}
                  <span className={f.included ? "text-foreground" : "text-muted-foreground/60 line-through"}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              variant={isCurrent ? "outline" : tier.highlighted ? "command" : "outline"}
              size="sm"
              className="mt-4 w-full"
              disabled={isCurrent || isDowngrade}
              onClick={() => onSelect(tier)}
              title={
                isCurrent
                  ? "This is your current plan"
                  : isDowngrade
                    ? "Downgrade via the billing portal"
                    : undefined
              }
            >
              {isCurrent ? "Current plan" : isDowngrade ? "Downgrade in portal" : tier.cta}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function BillingErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Couldn't load billing</p>
            <p className="text-xs text-muted-foreground mt-1">
              {error?.message || "Something went wrong loading your subscription."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="command"
            size="sm"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Link to="/pricing">
            <Button variant="outline" size="sm">View plans</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/billing")({
  component: BillingPage,
  errorComponent: BillingErrorComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    required: search.required === "1" ? "1" : undefined,
    plan: typeof search.plan === "string" ? search.plan : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Billing — Genesis" },
      { name: "description", content: "Manage your subscription, plan, and payment method" },
    ],
  }),
});

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusTone(status: string): {
  label: string;
  variant: "default" | "secondary" | "warning" | "destructive";
} {
  switch (status) {
    case "active":
      return { label: "Active", variant: "default" };
    case "trialing":
      return { label: "Trialing", variant: "secondary" };
    case "past_due":
      return { label: "Payment failed", variant: "warning" };
    case "paused":
      return { label: "Paused", variant: "warning" };
    case "canceled":
      return { label: "Canceled", variant: "destructive" };
    default:
      return { label: status, variant: "secondary" };
  }
}

async function openCustomerPortal() {
  try {
    const { data, error } = await supabase.functions.invoke("customer-portal", {
      body: {
        returnUrl: `${window.location.origin}/billing`,
        environment: getStripeEnvironment(),
      },
    });
    if (error || !data?.url) throw new Error(error?.message || "Could not open portal");
    window.open(data.url, "_blank");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Could not open billing portal");
  }
}

function BillingPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { subscription, hasAccess, inGrace, loading } = useSubscription(user?.id);
  const { openCheckout, CheckoutDialog } = useStripeCheckout();
  const autoOpenedRef = useRef(false);
  const [showPlans, setShowPlans] = useState(false);
  const [pendingTier, setPendingTier] = useState<PricingTier | null>(null);

  const isManual = subscription?.environment === "manual";

  const launchCheckout = useCallback(
    (tier: PricingTier) => {
      if (!tier.stripePriceId || !user?.email) return;
      openCheckout({
        mode: "price",
        priceId: tier.stripePriceId,
        customerEmail: user.email,
        userId: user.id,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      });
    },
    [openCheckout, user],
  );

  // When the user already has a paid subscription, intercept tier selection
  // and show a confirmation dialog with price difference + proration estimate.
  // First-time subscribers and manual/lifetime accounts skip the confirmation.
  const handleSelectTier = useCallback(
    (tier: PricingTier) => {
      if (!tier.stripePriceId || !user?.email) return;
      if (subscription && hasAccess && !isManual) {
        setPendingTier(tier);
        return;
      }
      launchCheckout(tier);
    },
    [launchCheckout, subscription, hasAccess, isManual, user],
  );

  const currentTier = useMemo(
    () => (subscription?.price_id ? findTierByPriceId(subscription.price_id) : undefined),
    [subscription?.price_id],
  );

  const switchSummary = useMemo(() => {
    if (!pendingTier || !currentTier) return null;
    const currentPrice = parsePriceToNumber(currentTier.price);
    const newPrice = parsePriceToNumber(pendingTier.price);
    if (currentPrice === null || newPrice === null) return null;
    const direction: "upgrade" | "downgrade" | "same" =
      newPrice > currentPrice ? "upgrade" : newPrice < currentPrice ? "downgrade" : "same";
    const proration = estimateProration({
      currentPrice,
      newPrice,
      periodStart: subscription?.current_period_start ?? null,
      periodEnd: subscription?.current_period_end ?? null,
    });
    return { currentPrice, newPrice, direction, proration };
  }, [pendingTier, currentTier, subscription]);

  // Auto-open Stripe checkout when ?plan=... is in the URL and user has no active subscription.
  // Waits for the auth session AND the user's email to fully load — important when arriving
  // from an email confirmation link where the session is still being established.
  useEffect(() => {
    if (loading || !user?.email || hasAccess || !search.plan || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    openCheckout({
      mode: "price",
      priceId: search.plan,
      customerEmail: user.email,
      userId: user.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
    // Strip ?plan= from the URL so it doesn't reopen on refresh after closing
    navigate({
      to: "/billing",
      search: { required: search.required, plan: undefined },
      replace: true,
    });
  }, [loading, user, hasAccess, search.plan, search.required, openCheckout, navigate]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // No subscription → show maintenance notice
  if (!subscription || !hasAccess) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            Billing
          </h1>
          <p className="text-sm text-muted-foreground">
            {search.required
              ? "Your workspace is locked until you have an active subscription."
              : "Manage your subscription and payment method."}
          </p>
        </div>

        {search.required && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Subscription required</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your workspace is locked until you have an active subscription.
              </p>
            </div>
          </div>
        )}

        {search.plan && (() => {
          const tier = findTierByPriceId(search.plan);
          if (!tier) return null;
          return (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">You're subscribing to</p>
              <div className="mt-1 flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">{tier.name}</h2>
                <p className="text-lg font-semibold text-foreground">
                  {tier.price}
                  <span className="text-sm font-normal text-muted-foreground">{tier.period}</span>
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{tier.description}</p>
            </div>
          );
        })()}

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-start gap-3 mb-4">
            <CreditCard className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Choose a plan to get started</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pick a plan below — checkout opens right here in one click.
              </p>
            </div>
          </div>
          <InlinePlans onSelect={handleSelectTier} />
          <div className="mt-4 flex justify-center">
            <Link to="/contact">
              <Button variant="outline" size="sm">Talk to sales</Button>
            </Link>
          </div>
        </div>
        {CheckoutDialog}
      </div>
    );
  }

  // Has an active subscription
  const tone = statusTone(subscription.status);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Billing
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription, change plans, or update your payment method.
        </p>
      </div>

      {inGrace && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Payment failed — update your card</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              We'll keep retrying for a few days. Update your payment method to avoid losing access.
            </p>
          </div>
          <Button variant="command" size="sm" onClick={openCustomerPortal}>
            Update payment
          </Button>
        </div>
      )}

      {/* Current plan card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</p>
            <h2 className="text-xl font-bold text-foreground mt-0.5">
              {isManual ? (
                <span className="flex items-center gap-2">
                  <InfinityIcon className="h-5 w-5 text-primary" />
                  Lifetime / Paid externally
                </span>
              ) : (
                subscription.product_id
              )}
            </h2>
          </div>
          <Badge variant={tone.variant} className="shrink-0">
            {tone.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Started</p>
            <p className="text-foreground">{formatDate(subscription.current_period_start)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {subscription.cancel_at_period_end ? "Ends" : "Renews"}
            </p>
            <p className="text-foreground">{formatDate(subscription.current_period_end)}</p>
          </div>
        </div>

        {subscription.cancel_at_period_end && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Your subscription is scheduled to cancel on{" "}
              <strong>{formatDate(subscription.current_period_end)}</strong>. You'll lose access after that date.
            </span>
          </div>
        )}
      </div>

      {/* Manage subscription via Stripe portal */}
      {!isManual && (
        <div className="rounded-xl border border-border bg-card p-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Manage subscription</p>
            <p className="text-xs text-muted-foreground mt-1">
              Update your payment method, change plan, download invoices, or cancel.
            </p>
          </div>
          <Button variant="command" size="sm" onClick={openCustomerPortal}>
            Open billing portal
          </Button>
        </div>
      )}

      {/* Upgrade / change plan — explicit CTA so users don't need to dig through Stripe portal */}
      {!isManual && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Want to upgrade?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Compare every CRM and white-label plan side-by-side, then switch in one click.
              </p>
            </div>
            <Button variant="command" size="sm" onClick={() => setShowPlans((v) => !v)}>
              {showPlans ? "Hide plans" : "View all plans"}
            </Button>
          </div>
          {showPlans && (
            <InlinePlans
              onSelect={handleSelectTier}
              currentPriceId={subscription.price_id}
            />
          )}
        </div>
      )}

      {isManual && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Lifetime access</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This account was provisioned with a one-off payment. There's nothing to renew or cancel.
              Contact your account manager for any changes.
            </p>
          </div>
        </div>
      )}
      {CheckoutDialog}
      <PlanSwitchConfirmDialog
        pendingTier={pendingTier}
        currentTier={currentTier}
        switchSummary={switchSummary}
        onCancel={() => setPendingTier(null)}
        onConfirm={() => {
          if (pendingTier) {
            const t = pendingTier;
            setPendingTier(null);
            launchCheckout(t);
          }
        }}
      />
    </div>
  );
}

function PlanSwitchConfirmDialog({
  pendingTier,
  currentTier,
  switchSummary,
  onCancel,
  onConfirm,
}: {
  pendingTier: PricingTier | null;
  currentTier: PricingTier | undefined;
  switchSummary: {
    currentPrice: number;
    newPrice: number;
    direction: "upgrade" | "downgrade" | "same";
    proration: { prorationToday: number; daysRemaining: number; cycleDays: number } | null;
  } | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const open = !!pendingTier;
  const isUpgrade = switchSummary?.direction === "upgrade";
  const isDowngrade = switchSummary?.direction === "downgrade";
  const delta = switchSummary ? switchSummary.newPrice - switchSummary.currentPrice : 0;
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isUpgrade ? (
              <TrendingUp className="h-5 w-5 text-primary" />
            ) : isDowngrade ? (
              <TrendingDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Sparkles className="h-5 w-5 text-primary" />
            )}
            Confirm plan switch
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              {/* From → To */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">From</p>
                    <p className="font-medium text-foreground truncate">
                      {currentTier?.name ?? "Current plan"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {currentTier?.price}
                      {currentTier?.period}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">To</p>
                    <p className="font-medium text-foreground truncate">{pendingTier?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pendingTier?.price}
                      {pendingTier?.period}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price difference */}
              {switchSummary && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Monthly difference</span>
                    <span
                      className={
                        isUpgrade
                          ? "font-semibold text-foreground"
                          : isDowngrade
                            ? "font-semibold text-muted-foreground"
                            : "text-foreground"
                      }
                    >
                      {delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toFixed(0)}/mo
                    </span>
                  </div>

                  {/* Proration estimate */}
                  {switchSummary.proration && isUpgrade && switchSummary.proration.prorationToday > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Charged today (prorated, {switchSummary.proration.daysRemaining} of{" "}
                        {switchSummary.proration.cycleDays} days left)
                      </span>
                      <span className="font-semibold text-foreground">
                        ~${switchSummary.proration.prorationToday.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {isDowngrade && (
                    <p className="text-xs text-muted-foreground">
                      You'll receive a credit for the unused portion of your current plan, applied to
                      your next invoice. No charge today.
                    </p>
                  )}

                  {isUpgrade && (
                    <p className="text-xs text-muted-foreground">
                      Estimate based on your current billing cycle. Stripe calculates the exact
                      proration at checkout.
                    </p>
                  )}
                </div>
              )}

              {!switchSummary && (
                <p className="text-xs text-muted-foreground">
                  This plan has custom pricing — you'll see the exact amount in checkout.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {isUpgrade ? "Upgrade now" : isDowngrade ? "Switch plan" : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
