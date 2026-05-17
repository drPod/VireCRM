import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/payment-status")({
  component: PaymentStatusPage,
  validateSearch: (s: Record<string, unknown>) => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment status — Majix" },
      {
        name: "description",
        content: "Verify your Stripe checkout and subscription state in real time.",
      },
    ],
  }),
});

type VerifyResponse = {
  environment: "sandbox" | "live";
  session: {
    id: string;
    status: "open" | "complete" | "expired" | string;
    payment_status: "paid" | "unpaid" | "no_payment_required" | string;
    mode: string;
    amount_total: number | null;
    currency: string | null;
    customer_email: string | null;
    created: number;
  };
  subscription: {
    id: string;
    status: string;
    cancel_at_period_end: boolean;
    current_period_start: string | null;
    current_period_end: string | null;
  } | null;
  plan: {
    lookup_key: string | null;
    amount: number | null;
    currency: string | null;
    interval: string | null;
  } | null;
};

function formatMoney(cents: number | null, currency: string | null) {
  if (cents == null || !currency) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function StatusBadge({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  if (ok) return <Badge className="bg-success/15 text-success border-success/30">{label}</Badge>;
  if (warn)
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">{label}</Badge>;
  return <Badge variant="destructive">{label}</Badge>;
}

function PaymentStatusPage() {
  const { session_id } = useSearch({ from: Route.id });
  const { user } = useAuth();
  const { subscription, hasAccess, refresh } = useSubscription(user?.id);

  const [inputId, setInputId] = useState(session_id ?? "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);

  const verify = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke(
        "verify-checkout-session",
        {
          body: { sessionId: id, environment: getStripeEnvironment() },
        },
      );
      if (fnError) throw new Error(fnError.message);
      if (!res || (res as { error?: string }).error) {
        throw new Error((res as { error?: string })?.error || "Failed to verify");
      }
      setData(res as VerifyResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load when session_id arrives via URL
  useEffect(() => {
    if (session_id) {
      setInputId(session_id);
      void verify(session_id);
    }
  }, [session_id, verify]);

  // Auto-refresh until the webhook has landed an active subscription locally,
  // then stop. Mirrors the polling in /checkout/return so the user sees both
  // the live Stripe state AND the workspace entitlement converge.
  useEffect(() => {
    if (!auto || !data?.session?.id) return;
    const stripeSettled =
      data.session.status === "complete" &&
      (data.session.payment_status === "paid" ||
        data.session.payment_status === "no_payment_required") &&
      (data.subscription ? ["active", "trialing"].includes(data.subscription.status) : true);
    if (stripeSettled && hasAccess) return;
    const t = setTimeout(() => {
      void verify(data.session.id);
      void refresh();
    }, 3000);
    return () => clearTimeout(t);
  }, [auto, data, hasAccess, verify, refresh]);

  const sessionOk =
    data?.session?.status === "complete" && data?.session?.payment_status !== "unpaid";
  const subOk = data?.subscription
    ? ["active", "trialing"].includes(data.subscription.status)
    : null;

  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Payment status</h1>
        <p className="text-sm text-muted-foreground">
          Real-time check against Stripe for any checkout session. Confirms whether the payment
          completed and surfaces the live subscription state.
        </p>
        <div className="text-xs text-muted-foreground">
          Environment:{" "}
          <span className="font-mono font-medium text-foreground">{getStripeEnvironment()}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verify a checkout session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="session-id">Stripe session ID</Label>
            <div className="flex gap-2">
              <Input
                id="session-id"
                placeholder="cs_test_… or cs_live_…"
                value={inputId}
                onChange={(e) => setInputId(e.target.value.trim())}
                className="font-mono text-xs"
              />
              <Button
                onClick={() => void verify(inputId)}
                disabled={!inputId || loading}
                variant="command"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: arriving here from Stripe? The <code className="font-mono">session_id</code> is
              auto-filled from the URL.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-3 pt-6">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Verification failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              {sessionOk ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : data.session.status === "open" ? (
                <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              Checkout session
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void verify(data.session.id);
                void refresh();
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="ml-2">Refresh</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Field label="Session status">
                <StatusBadge
                  ok={data.session.status === "complete"}
                  warn={data.session.status === "open"}
                  label={data.session.status}
                />
              </Field>
              <Field label="Payment status">
                <StatusBadge
                  ok={
                    data.session.payment_status === "paid" ||
                    data.session.payment_status === "no_payment_required"
                  }
                  warn={data.session.payment_status === "unpaid"}
                  label={data.session.payment_status}
                />
              </Field>
              <Field label="Mode">{data.session.mode}</Field>
              <Field label="Amount">
                {formatMoney(data.session.amount_total, data.session.currency)}
              </Field>
              <Field label="Customer email">{data.session.customer_email ?? "—"}</Field>
              <Field label="Created">
                {new Date(data.session.created * 1000).toLocaleString()}
              </Field>
            </dl>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Plan</h3>
              {data.plan ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <Field label="Plan">
                    <span className="font-mono text-xs">{data.plan.lookup_key ?? "—"}</span>
                  </Field>
                  <Field label="Price">
                    {formatMoney(data.plan.amount, data.plan.currency)}
                    {data.plan.interval ? ` / ${data.plan.interval}` : ""}
                  </Field>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">No plan info on this session.</p>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                Subscription
                {data.subscription &&
                  (subOk ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ))}
              </h3>
              {data.subscription ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <Field label="Status">
                    <StatusBadge
                      ok={["active", "trialing"].includes(data.subscription.status)}
                      warn={["past_due", "incomplete"].includes(data.subscription.status)}
                      label={data.subscription.status}
                    />
                  </Field>
                  <Field label="Cancels at period end">
                    {data.subscription.cancel_at_period_end ? "Yes" : "No"}
                  </Field>
                  <Field label="Current period">
                    {data.subscription.current_period_start
                      ? new Date(data.subscription.current_period_start).toLocaleDateString()
                      : "—"}{" "}
                    →{" "}
                    {data.subscription.current_period_end
                      ? new Date(data.subscription.current_period_end).toLocaleDateString()
                      : "—"}
                  </Field>
                  <Field label="Subscription ID">
                    <span className="font-mono text-[10px]">{data.subscription.id}</span>
                  </Field>
                </dl>
              ) : data.session.mode === "subscription" ? (
                <p className="text-sm text-muted-foreground">
                  Stripe hasn't created the subscription yet — usually a few seconds.
                  Auto-refreshing…
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">One-time payment — no subscription.</p>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium text-foreground mb-2">Workspace entitlement</h3>
              <div className="flex items-center gap-2 text-sm">
                {hasAccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-foreground">Active in this workspace</span>
                    {subscription?.price_id && (
                      <span className="text-xs text-muted-foreground">
                        (plan: <span className="font-mono">{subscription.price_id}</span>)
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                    <span className="text-muted-foreground">
                      Waiting for the webhook to unlock your workspace…
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                  className="rounded border-border"
                />
                Auto-refresh every 3s until settled
              </label>
              <Link to="/dashboard">
                <Button variant="command" size="sm" className="gap-2">
                  Go to dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {!data && !loading && !error && !session_id && (
        <p className="text-sm text-muted-foreground text-center">
          Paste a Stripe checkout session ID above, or land here from a checkout return URL.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
