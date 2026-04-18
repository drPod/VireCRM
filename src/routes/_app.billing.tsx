import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { crmTiers, whiteLabelTiers, type PricingTier } from "@/components/marketing/PricingCards";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  XCircle,
  RefreshCw,
  Sparkles,
  Infinity as InfinityIcon,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/billing")({
  component: BillingPage,
  validateSearch: (search: Record<string, unknown>) => ({
    required: search.required === "1" ? "1" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Billing — Vireon" },
      { name: "description", content: "Manage your subscription, plan, and payment method" },
    ],
  }),
});

const ALL_PURCHASABLE_TIERS: PricingTier[] = [...crmTiers, ...whiteLabelTiers].filter(
  (t) => !!t.paddlePriceId,
);

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

function BillingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { subscription, hasAccess, inGrace, loading, refresh } = useSubscription(user?.id);
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [portalLoading, setPortalLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<null | "cancel" | "resume">(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [newPlanId, setNewPlanId] = useState<string>("");
  const [changing, setChanging] = useState(false);

  const isManual = subscription?.environment === "manual";
  const isPaddleManaged = subscription && !isManual && subscription.paddle_subscription_id &&
    !subscription.paddle_subscription_id.startsWith("txn_");

  // Try to find which marketing tier this matches so we can show its name + features.
  const matchedTier = ALL_PURCHASABLE_TIERS.find(
    (t) => t.paddlePriceId === subscription?.price_id,
  );

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", { body: {} });
      if (error) throw error;
      if (!data?.url) throw new Error("Could not open portal");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const cancelSub = async () => {
    setActionLoading("cancel");
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", {
        body: { action: "cancel" },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Cancel failed");
      toast.success("Subscription will end at the current period");
      setConfirmCancel(false);
      // Webhook will sync state — also refresh manually after a short delay
      setTimeout(refresh, 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionLoading(null);
    }
  };

  const resumeSub = async () => {
    setActionLoading("resume");
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", {
        body: { action: "resume" },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Resume failed");
      toast.success("Subscription resumed");
      setTimeout(refresh, 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setActionLoading(null);
    }
  };

  const changePlan = async () => {
    if (!newPlanId) return;
    setChanging(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", {
        body: { action: "change_price", newPriceExternalId: newPlanId },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Change failed");
      toast.success("Plan changed — proration applied");
      setChangeOpen(false);
      setTimeout(refresh, 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Change failed");
    } finally {
      setChanging(false);
    }
  };

  const handleSubscribe = (tier: PricingTier) => {
    if (!tier.paddlePriceId || !user) return;
    openCheckout({
      priceId: tier.paddlePriceId,
      customerEmail: user.email ?? undefined,
      customData: { userId: user.id },
      successUrl: `${window.location.origin}/dashboard?checkout=success`,
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // No subscription at all → show plan picker
  if (!subscription || !hasAccess) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            Billing
          </h1>
          <p className="text-sm text-muted-foreground">
            {search.required
              ? "Pick a plan to access your workspace."
              : "Choose a plan to get started."}
          </p>
        </div>

        {search.required && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Subscription required
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your workspace is locked until you have an active subscription.
                Pick a plan below or contact support if you believe this is a mistake.
              </p>
            </div>
          </div>
        )}

        {subscription && subscription.status === "canceled" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Your previous subscription was canceled
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Resubscribe below to restore access.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALL_PURCHASABLE_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border p-5 flex flex-col ${
                tier.highlighted ? "border-primary/40 bg-primary/5" : "border-border bg-card"
              }`}
            >
              {tier.badge && (
                <Badge variant={tier.highlighted ? "default" : "secondary"} className="mb-2 self-start gap-1">
                  {tier.highlighted && <Sparkles className="h-3 w-3" />}
                  {tier.badge}
                </Badge>
              )}
              <h3 className="text-base font-semibold text-foreground">{tier.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{tier.price}</span>
                <span className="text-xs text-muted-foreground">{tier.period}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{tier.description}</p>
              <Button
                variant={tier.highlighted ? "command" : "outline"}
                size="sm"
                className="mt-4 gap-2"
                onClick={() => handleSubscribe(tier)}
                disabled={checkoutLoading}
              >
                {checkoutLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Subscribe
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Need a custom or white-label plan?{" "}
          <Link to="/contact" className="text-primary hover:underline">
            Contact us
          </Link>
        </p>
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
          <Button variant="command" size="sm" onClick={openPortal} disabled={portalLoading}>
            {portalLoading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
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
                matchedTier?.name || subscription.product_id
              )}
            </h2>
          </div>
          <Badge variant={tone.variant} className="shrink-0">
            {tone.label}
          </Badge>
        </div>

        {!isManual && matchedTier && (
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-2xl font-bold text-foreground">{matchedTier.price}</span>
            <span className="text-xs text-muted-foreground">{matchedTier.period}</span>
          </div>
        )}

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

      {/* Actions */}
      {isPaddleManaged && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Manage subscription</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setChangeOpen(true)}
            >
              <ArrowUpRight className="h-4 w-4" />
              Change plan
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={openPortal}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Update payment method
            </Button>

            {subscription.cancel_at_period_end ? (
              <Button
                variant="outline"
                className="justify-start gap-2 sm:col-span-2"
                onClick={resumeSub}
                disabled={actionLoading === "resume"}
              >
                {actionLoading === "resume" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Resume subscription
              </Button>
            ) : (
              <Button
                variant="outline"
                className="justify-start gap-2 text-destructive hover:text-destructive sm:col-span-2"
                onClick={() => setConfirmCancel(true)}
              >
                <XCircle className="h-4 w-4" />
                Cancel subscription
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Cancellations take effect at the end of your current period — you keep access until then.
          </p>
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

      {/* Cancel confirmation */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              You'll keep access until <strong>{formatDate(subscription.current_period_end)}</strong>.
              After that, your workspace will be locked until you resubscribe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Keep subscription
            </Button>
            <Button variant="destructive" onClick={cancelSub} disabled={actionLoading === "cancel"}>
              {actionLoading === "cancel" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change plan */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>
              The new price is prorated and billed immediately. The next renewal will use the new price.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Select value={newPlanId} onValueChange={setNewPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a new plan" />
              </SelectTrigger>
              <SelectContent>
                {ALL_PURCHASABLE_TIERS.filter((t) => t.paddlePriceId !== subscription.price_id).map(
                  (t) => (
                    <SelectItem key={t.paddlePriceId} value={t.paddlePriceId!}>
                      {t.name} — {t.price}
                      {t.period}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>
              Cancel
            </Button>
            <Button variant="command" onClick={changePlan} disabled={!newPlanId || changing}>
              {changing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
