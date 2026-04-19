import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Terminal, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { StripeEmbeddedCheckoutForm } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/r/$resellerSlug/checkout/$planSlug")({
  component: ResellerCheckoutPage,
  head: () => ({
    meta: [
      { title: "Checkout" },
      { name: "description", content: "Complete your subscription" },
    ],
  }),
});

interface PublicPlan {
  plan_id: string;
  reseller_id: string;
  reseller_slug: string;
  reseller_brand_name: string | null;
  reseller_logo_url: string | null;
  reseller_primary_color: string | null;
  plan_name: string;
  plan_description: string | null;
  features: string[];
  base_price_id: string;
  monthly_price_cents: number;
  currency: string;
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function ResellerCheckoutPage() {
  const { resellerSlug, planSlug } = Route.useParams();
  const { user } = useAuth();
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("get_reseller_plan_public", {
        p_reseller_slug: resellerSlug,
        p_plan_slug: planSlug,
      });
      const p = data as PublicPlan | null;
      if (!p) {
        setNotFound(true);
      } else {
        setPlan(p);
      }
      setLoading(false);
    })();
  }, [resellerSlug, planSlug]);

  const accent = plan?.reseller_primary_color || undefined;
  const brandName = plan?.reseller_brand_name || "CRM";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Plan not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This checkout link is invalid or no longer active.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PaymentTestModeBanner />
      <div className="flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Plan summary */}
          <div className="rounded-2xl border border-border bg-card p-8">
            <div className="flex items-center gap-3 mb-6">
              {plan.reseller_logo_url ? (
                <img
                  src={plan.reseller_logo_url}
                  alt={brandName}
                  className="h-10 w-10 rounded-lg object-contain"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: accent || "hsl(var(--primary))" }}
                >
                  <Terminal className="h-5 w-5 text-white" />
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">You're subscribing to</p>
                <p className="text-sm font-semibold text-foreground">{brandName}</p>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-foreground">{plan.plan_name}</h1>
            {plan.plan_description && (
              <p className="mt-2 text-sm text-muted-foreground">{plan.plan_description}</p>
            )}

            <div className="mt-6 mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground">
                  {formatCents(plan.monthly_price_cents, plan.currency)}
                </span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
            </div>

            {plan.features.length > 0 && (
              <ul className="space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2
                      className="h-4 w-4 mt-0.5 flex-shrink-0"
                      style={{ color: accent || "hsl(var(--primary))" }}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Embedded Stripe checkout */}
          <div className="rounded-2xl border border-border bg-card p-4 lg:p-6">
            <StripeEmbeddedCheckoutForm
              mode="reseller"
              resellerSlug={resellerSlug}
              planSlug={planSlug}
              customerEmail={user?.email}
              userId={user?.id}
              returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

