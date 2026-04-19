import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
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
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

export const Route = createFileRoute("/_app/billing")({
  component: BillingPage,
  validateSearch: (search: Record<string, unknown>) => ({
    required: search.required === "1" ? "1" : undefined,
    plan: typeof search.plan === "string" ? search.plan : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Billing — Vireon" },
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

  const isManual = subscription?.environment === "manual";

  // Auto-open Stripe checkout when ?plan=... is in the URL and user has no active subscription
  useEffect(() => {
    if (loading || !user || hasAccess || !search.plan || autoOpenedRef.current) return;
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

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 flex items-start gap-3">
          <Wrench className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Self-serve checkout is temporarily unavailable
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              We're switching payment providers and will be back online shortly. In the meantime, please{" "}
              <Link to="/contact" className="text-primary hover:underline">
                contact us
              </Link>{" "}
              to subscribe or upgrade.
            </p>
          </div>
        </div>
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

      {/* Maintenance banner */}
      {!isManual && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 flex items-start gap-3">
          <Wrench className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Self-serve subscription management is temporarily unavailable
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              We're switching payment providers. To change your plan, update your payment method, or cancel,
              please{" "}
              <Link to="/contact" className="text-primary hover:underline">
                contact support
              </Link>
              .
            </p>
          </div>
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
    </div>
  );
}
