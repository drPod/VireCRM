import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Terminal, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { initializePaddle } from "@/lib/paddle";
import { toast } from "sonner";

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
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        setUser({ id: sess.session.user.id, email: sess.session.user.email ?? null });
        setEmail(sess.session.user.email ?? "");
      }
      setLoading(false);
    })();
  }, [resellerSlug, planSlug]);

  // After OAuth/email-confirm callback resume checkout
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "1") return;
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session || !plan) return;
      const pendingCompany =
        sessionStorage.getItem("rc_pending_company") ||
        sess.session.user.email?.split("@")[0] ||
        "My Company";
      try {
        await provisionAndCheckout(pendingCompany, sess.session.user.email ?? "");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Checkout failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const accent = plan?.reseller_primary_color || undefined;
  const brandName = plan?.reseller_brand_name || "CRM";

  const provisionAndCheckout = async (companyForProvision: string, emailForCheckout: string) => {
    if (!plan) return;
    // Provision under the reseller (idempotent — RPC moves user into a child org)
    const { data: provision, error: provErr } = await supabase.rpc("signup_under_reseller", {
      p_reseller_slug: plan.reseller_slug,
      p_company_name: companyForProvision,
    });
    if (provErr) throw provErr;
    const provisionResult = provision as { success: boolean; error?: string } | null;
    if (!provisionResult?.success) {
      throw new Error(provisionResult?.error || "Failed to set up workspace");
    }
    sessionStorage.removeItem("rc_pending_company");

    // Resolve the marked-up Paddle price (creates one if needed)
    const env = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN?.startsWith("test_")
      ? "sandbox"
      : "live";
    const { data: priceData, error: priceErr } = await supabase.functions.invoke(
      "create-reseller-checkout",
      { body: { resellerPlanId: plan.plan_id, environment: env } },
    );
    if (priceErr || !priceData?.paddlePriceId) {
      throw new Error("Could not prepare checkout. Try again or contact support.");
    }

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    await initializePaddle();
    window.Paddle.Checkout.open({
      items: [{ priceId: priceData.paddlePriceId, quantity: 1 }],
      customer: { email: emailForCheckout },
      customData: {
        userId: userId ?? "",
        resellerId: plan.reseller_id,
        resellerPlanId: plan.plan_id,
      },
      settings: {
        displayMode: "overlay",
        successUrl: `${window.location.origin}/dashboard?checkout=success`,
        allowLogout: false,
        variant: "one-page",
      },
    });
  };

  const handleSignupAndCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    if (!fullName || !companyName || !email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      sessionStorage.setItem("rc_pending_company", companyName);
      const { data: signupData, error: signupErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/r/${resellerSlug}/checkout/${planSlug}?resume=1`,
        },
      });
      if (signupErr) throw signupErr;
      if (signupData.session) {
        await provisionAndCheckout(companyName, email);
      } else {
        navigate({ to: "/confirm-email" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!companyName) {
      toast.error("Please enter your company name first");
      return;
    }
    sessionStorage.setItem("rc_pending_company", companyName);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/r/${resellerSlug}/checkout/${planSlug}?resume=1`,
    });
    if (result.error) {
      toast.error(result.error instanceof Error ? result.error.message : "Google sign-in failed");
    }
  };

  const handleExistingUserCheckout = async () => {
    if (!plan || !user) return;
    setSubmitting(true);
    try {
      const company =
        companyName ||
        sessionStorage.getItem("rc_pending_company") ||
        user.email?.split("@")[0] ||
        "My Company";
      await provisionAndCheckout(company, user.email ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

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
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
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

        {/* Signup / continue */}
        <div className="rounded-2xl border border-border bg-card p-8">
          {user ? (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Welcome back, {user.email}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                You're signed in. Confirm your company name and continue to payment.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Acme Inc"
                  />
                </div>
                <Button
                  variant="command"
                  className="w-full gap-2"
                  onClick={handleExistingUserCheckout}
                  disabled={submitting}
                  style={accent ? { backgroundColor: accent } : undefined}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continue to payment
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-2">Create your account</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Fill in your details and you'll be taken to checkout.
              </p>
              <form onSubmit={handleSignupAndCheckout} className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleGoogleSignup}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign up with Google
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 text-xs text-muted-foreground">or</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Acme Inc"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                    placeholder="••••••••"
                  />
                </div>

                <Button
                  type="submit"
                  variant="command"
                  className="w-full gap-2"
                  disabled={submitting}
                  style={accent ? { backgroundColor: accent } : undefined}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continue to payment
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Secure payment powered by Paddle. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
