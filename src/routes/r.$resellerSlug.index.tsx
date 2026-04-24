import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Terminal, Check, Zap, Bot, BrainCircuit, CalendarCheck, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  applyBrandFont,
  applyFavicon,
  applyWhiteLabelColor,
} from "@/lib/white-label-theme";

export const Route = createFileRoute("/r/$resellerSlug/")({
  component: ResellerLandingPage,
  head: () => ({
    meta: [
      { title: "Get started" },
      { name: "description", content: "AI-powered CRM for your sales team" },
    ],
  }),
});

interface ResellerBranding {
  id: string;
  slug: string;
  brand_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  font_family: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  sidebar_color: string | null;
  button_color: string | null;
  is_reseller: boolean;
  support_email: string | null;
}

interface PublicPlan {
  plan_id: string;
  slug: string;
  name: string;
  description: string | null;
  features: string[];
  monthly_price_cents: number;
  currency: string;
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function ResellerLandingPage() {
  const { resellerSlug } = Route.useParams();
  const [branding, setBranding] = useState<ResellerBranding | null>(null);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void (async () => {
      const [{ data: brandData }, { data: plansData }] = await Promise.all([
        supabase.rpc("get_reseller_branding", { p_slug: resellerSlug }),
        supabase.rpc("list_reseller_plans_public", { p_reseller_slug: resellerSlug }),
      ]);
      const b = brandData as ResellerBranding | null;
      if (!b || !b.is_reseller) {
        setNotFound(true);
      } else {
        setBranding(b);
        setPlans((plansData as PublicPlan[]) || []);
      }
      setLoading(false);
    })();
  }, [resellerSlug]);

  // Apply the reseller's full palette, favicon, and font to the page chrome
  useEffect(() => {
    return applyWhiteLabelColor({
      primary: branding?.primary_color,
      secondary: branding?.secondary_color,
      accent: branding?.accent_color,
      sidebar: branding?.sidebar_color,
      button: branding?.button_color,
    });
  }, [
    branding?.primary_color,
    branding?.secondary_color,
    branding?.accent_color,
    branding?.sidebar_color,
    branding?.button_color,
  ]);

  useEffect(() => {
    return applyFavicon(branding?.favicon_url);
  }, [branding?.favicon_url]);

  useEffect(() => {
    return applyBrandFont(branding?.font_family);
  }, [branding?.font_family]);

  // Update document title to reflect the reseller brand
  useEffect(() => {
    if (!branding?.brand_name || typeof document === "undefined") return;
    const original = document.title;
    document.title = `${branding.brand_name} — AI CRM for your sales team`;
    return () => {
      document.title = original;
    };
  }, [branding?.brand_name]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Workspace not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This reseller link is invalid or no longer active.
          </p>
        </div>
      </div>
    );
  }

  const brandName = branding?.brand_name || "CRM";
  const accent = branding?.primary_color || undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={brandName}
                className="h-9 w-9 rounded-lg object-contain"
              />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: accent }}
              >
                <Terminal className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <span className="text-base font-semibold text-foreground">{brandName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button variant="command" size="sm" asChild>
              <Link to="/r/$resellerSlug/signup" params={{ resellerSlug }}>
                Get started
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-20 blur-3xl"
          style={{
            background: accent
              ? `radial-gradient(60% 50% at 50% 0%, ${accent} 0%, transparent 70%)`
              : undefined,
          }}
        />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            AI-powered sales CRM
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Never let a lead
            <br />
            <span style={{ color: accent }}>go cold again.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            {brandName} responds instantly, follows up relentlessly, and surfaces
            your hottest leads — so your team always knows who to call next.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="command" size="lg" className="gap-2" asChild>
              <Link to="/r/$resellerSlug/signup" params={{ resellerSlug }}>
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {plans.length > 0 && (
              <Button variant="outline" size="lg" asChild>
                <a href="#pricing">See pricing</a>
              </Button>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required to start
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              Built to help your team close more deals
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Stop losing revenue to slow follow-up. {brandName} does the chasing —
              your team does the closing.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Zap,
                title: "Instant response",
                desc: "Reply to every lead in seconds, 24/7 — even at 3am on a Sunday.",
              },
              {
                icon: Bot,
                title: "Tireless follow-up",
                desc: "Multi-step sequences that nurture leads until they're ready.",
              },
              {
                icon: BrainCircuit,
                title: "AI lead scoring",
                desc: "Surface the hottest, most ready-to-buy leads to the top of your pipeline.",
              },
              {
                icon: CalendarCheck,
                title: "Hand-off ready",
                desc: "Hot leads land in your reps' hands with full context — ready to close.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: accent ? `${accent}22` : undefined }}
                >
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      {plans.length > 0 && (
        <section id="pricing" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Pick the plan that fits your team. Upgrade or cancel any time.
              </p>
            </div>
            <div
              className={`mx-auto mt-12 grid gap-6 ${
                plans.length === 1
                  ? "max-w-md"
                  : plans.length === 2
                    ? "max-w-3xl sm:grid-cols-2"
                    : "max-w-5xl sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {plans.map((plan, idx) => {
                const isPopular = plans.length > 1 && idx === Math.floor(plans.length / 2);
                return (
                  <div
                    key={plan.plan_id}
                    className="relative flex flex-col rounded-2xl border bg-card p-6"
                    style={{
                      borderColor: isPopular && accent ? accent : undefined,
                    }}
                  >
                    {isPopular && (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-primary-foreground"
                        style={{ backgroundColor: accent }}
                      >
                        Most popular
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-foreground">
                      {plan.name}
                    </h3>
                    {plan.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                    )}
                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        {formatCents(plan.monthly_price_cents, plan.currency)}
                      </span>
                      <span className="text-sm text-muted-foreground">/mo</span>
                    </div>
                    <ul className="mt-6 space-y-3">
                      {plan.features.map((feat) => (
                        <li
                          key={feat}
                          className="flex items-start gap-2 text-sm text-foreground"
                        >
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: accent }}
                          />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={isPopular ? "command" : "outline"}
                      className="mt-8 w-full"
                      asChild
                    >
                      <Link
                        to="/r/$resellerSlug/checkout/$planSlug"
                        params={{ resellerSlug, planSlug: plan.slug }}
                      >
                        Get {plan.name}
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            Ready to grow with {brandName}?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Set up your workspace in under two minutes. No credit card required.
          </p>
          <div className="mt-8">
            <Button variant="command" size="lg" className="gap-2" asChild>
              <Link to="/r/$resellerSlug/signup" params={{ resellerSlug }}>
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <div>
            © {new Date().getFullYear()} {brandName}. All rights reserved.
          </div>
          {branding?.support_email && (
            <a
              href={`mailto:${branding.support_email}`}
              className="hover:text-foreground"
            >
              {branding.support_email}
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
