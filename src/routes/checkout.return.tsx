import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/checkout/return")({
  component: CheckoutReturnPage,
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Payment complete — Vireon" }],
  }),
});

function CheckoutReturnPage() {
  const { session_id } = useSearch({ from: Route.id });
  const { user } = useAuth();
  const { subscription, hasAccess, refresh } = useSubscription(user?.id);
  const [activating, setActivating] = useState(true);

  // Poll for the webhook-driven subscription row to land. Stripe's webhook usually
  // arrives within 1-3 seconds, but it's async so we keep refreshing for a while.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled) return;
      attempts++;
      await refresh();
      if (cancelled) return;
      if (hasAccess || attempts >= 15) {
        setActivating(false);
      } else {
        setTimeout(tick, 2000);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [user?.id, refresh, hasAccess]);

  // Once we see the active sub, drop the spinner immediately.
  useEffect(() => {
    if (hasAccess) setActivating(false);
  }, [hasAccess]);

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
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">You're all set!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasAccess
                ? "Your subscription is active. Welcome to Vireon."
                : "Payment received — your access will be live within a minute. You can refresh from the dashboard."}
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

        <Link to="/dashboard">
          <Button variant="command" className="mt-6 gap-2 w-full">
            Go to dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
