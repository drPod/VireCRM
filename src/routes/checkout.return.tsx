import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight, Loader2, AlertTriangle, RefreshCw, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/checkout/return")({
  component: CheckoutReturnPage,
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Payment complete — Majix" }],
  }),
});

function CheckoutReturnPage() {
  const { session_id } = useSearch({ from: Route.id });
  const { user } = useAuth();
  const { subscription, hasAccess, refresh } = useSubscription(user?.id);
  const [activating, setActivating] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [pollNonce, setPollNonce] = useState(0);
  const [retrying, setRetrying] = useState(false);

  // Poll for the webhook-driven subscription row to land. Stripe's webhook usually
  // arrives within 1-3 seconds, but it's async so we keep refreshing for a while.
  // If we hit 15 attempts (~30s) without hasAccess, surface an explicit "activation
  // pending" state instead of lying with a green checkmark.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let attempts = 0;
    setActivating(true);
    setTimedOut(false);
    const tick = async () => {
      if (cancelled) return;
      attempts++;
      await refresh();
      if (cancelled) return;
      if (hasAccess) {
        setActivating(false);
        setTimedOut(false);
      } else if (attempts >= 15) {
        setActivating(false);
        setTimedOut(true);
      } else {
        setTimeout(tick, 2000);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [user?.id, refresh, hasAccess, pollNonce]);

  // Once we see the active sub, drop the spinner immediately.
  useEffect(() => {
    if (hasAccess) {
      setActivating(false);
      setTimedOut(false);
    }
  }, [hasAccess]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
    // Re-trigger the polling effect for another full 30s window if still not active.
    setPollNonce((n) => n + 1);
  }, [refresh]);

  const showFailure = timedOut && !hasAccess;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center rounded-2xl border border-border bg-card p-8 shadow-lg">
        {activating && !hasAccess ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Activating your account…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Payment received. We're unlocking your workspace — this usually takes a few seconds.
            </p>
          </>
        ) : showFailure ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Payment received — activation pending</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your payment went through, but the activation webhook hasn't landed yet. It usually
              clears within a few minutes. Retry below, or contact support if it persists.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">You're all set!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your subscription is active. Welcome to Majix.
            </p>
            {subscription?.price_id && (
              <p className="mt-3 text-xs text-muted-foreground">
                Plan: <span className="font-medium text-foreground">{subscription.price_id}</span>
              </p>
            )}
          </>
        )}

        {session_id && (
          <p className="mt-3 text-[10px] font-mono text-muted-foreground/50 break-all">
            Ref: {session_id}
          </p>
        )}

        {showFailure ? (
          <div className="mt-6 space-y-2">
            <Button
              variant="command"
              className="gap-2 w-full"
              onClick={handleRetry}
              disabled={retrying}
            >
              <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Checking…" : "Retry activation check"}
            </Button>
            <Button variant="outline" className="gap-2 w-full" asChild>
              <Link to="/contact">
                <LifeBuoy className="h-4 w-4" />
                Contact support
              </Link>
            </Button>
          </div>
        ) : (
          <Button variant="command" className="mt-6 gap-2 w-full" asChild>
            <Link to="/dashboard">
              Go to dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
