import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight, Sparkles, Crown, Building2, Monitor, Key, Info } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useNavigate } from "@tanstack/react-router";
import { applyPromoDiscount } from "@/components/marketing/PromoBanner";
import { getDisplayedPrice } from "@/lib/pricing-overrides";

export interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  badge?: string;
  highlighted?: boolean;
  features: { text: string; included: boolean }[];
  cta: string;
  ctaVariant: "outline" | "command" | "default";
  ctaLink?: string;
  isOwnership?: boolean;
  /** Stripe price lookup_key (set in test, automatically synced to live). */
  stripePriceId?: string;
  setupFee?: string;
}

// CRM tiers (non-white-label — just want the CRM)
export const crmTiers: PricingTier[] = [
  {
    name: "Starter — Get Organized Fast",
    price: "$97",
    period: "/month",
    description: "Everything you need to get your sales system off the ground and stay organized from day one.",
    stripePriceId: "crm_starter_monthly",
    features: [
      { text: "Contact management", included: true },
      { text: "Simple pipeline", included: true },
      { text: "Notes & tasks", included: true },
      { text: "Basic dashboard", included: true },
      { text: "Email support", included: true },
      { text: "Up to 1,000 emails/month", included: true },
      { text: "Up to 1,000 contacts", included: true },
      { text: "Automated follow-ups", included: false },
      { text: "Advanced automations", included: false },
      { text: "Team features", included: false },
    ],
    cta: "Get Started",
    ctaVariant: "outline",
  },
  {
    name: "Growth — Automate & Scale",
    price: "$197",
    period: "/month",
    description: "Turn your CRM into a consistent revenue engine with automated outreach and pipeline optimization.",
    badge: "Most Popular",
    highlighted: true,
    stripePriceId: "crm_growth_monthly",
    features: [
      { text: "Everything in Starter", included: true },
      { text: "Automated follow-ups (email + SMS)", included: true },
      { text: "Lead tracking & pipeline optimization", included: true },
      { text: "Basic reporting", included: true },
      { text: "Priority support", included: true },
      { text: "Up to 10,000 emails/month", included: true },
      { text: "Up to 10,000 contacts", included: true },
      { text: "Automation workflows", included: true },
      { text: "Custom pipelines", included: false },
      { text: "Team features", included: false },
    ],
    cta: "Get Started",
    ctaVariant: "command",
  },
  {
    name: "Pro — Full Sales System",
    price: "$297",
    period: "/month",
    description: "Built for scaling teams that need serious automation, deep visibility, and enterprise-grade workflows.",
    badge: "High Value",
    stripePriceId: "crm_pro_monthly",
    features: [
      { text: "Everything in Growth", included: true },
      { text: "Advanced automation", included: true },
      { text: "Custom pipelines", included: true },
      { text: "Integrations (calendar, forms, tools)", included: true },
      { text: "KPI dashboards", included: true },
      { text: "Team features", included: true },
      { text: "25,000+ emails/month (fair use)", included: true },
      { text: "Unlimited contacts", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "Custom onboarding", included: true },
    ],
    cta: "Get Started",
    ctaVariant: "command",
  },
  {
    name: "Custom CRM",
    price: "Custom",
    period: "quote",
    description: "A fully bespoke CRM — tailored workflows, advanced automations, unique dashboards, and integrations built around your business.",
    badge: "Premium",
    isOwnership: true,
    ctaLink: "/contact",
    features: [
      { text: "Fully customized system", included: true },
      { text: "Tailored workflows", included: true },
      { text: "Advanced automations", included: true },
      { text: "Unique dashboards", included: true },
      { text: "Business-specific integrations", included: true },
      { text: "Dedicated onboarding", included: true },
      { text: "Architecture consulting", included: true },
      { text: "Ongoing maintenance options", included: true },
    ],
    cta: "Contact Us",
    ctaVariant: "outline",
  },
];

// White-label tiers (leasing + ownership for resellers)
export const whiteLabelTiers: PricingTier[] = [
  {
    name: "Lease — Starter",
    price: "$249",
    period: "/month",
    description: "White-label Genesis CRM leased to your business. Full branding, your domain, your clients.",
    stripePriceId: "lease_starter_monthly",
    features: [
      { text: "White-label branding", included: true },
      { text: "Custom domain", included: true },
      { text: "Up to 2,000 leads", included: true },
      { text: "Pipeline management", included: true },
      { text: "Email outreach", included: true },
      { text: "AI lead scoring", included: true },
      { text: "AI reply classification", included: true },
      { text: "AI message generation", included: false },
      { text: "Auto follow-ups", included: false },
      { text: "Full source code", included: false },
    ],
    cta: "Start Lease",
    ctaVariant: "outline",
  },
  {
    name: "Lease — Professional",
    price: "$849",
    period: "/month",
    description: "Full-featured white-label CRM with all AI agents. Scale your sales operation.",
    badge: "Most Popular",
    highlighted: true,
    stripePriceId: "lease_pro_monthly",
    features: [
      { text: "White-label branding", included: true },
      { text: "Custom domain", included: true },
      { text: "Up to 25,000 leads", included: true },
      { text: "Pipeline management", included: true },
      { text: "Email + SMS outreach", included: true },
      { text: "AI lead scoring", included: true },
      { text: "AI reply classification", included: true },
      { text: "AI message generation", included: true },
      { text: "Auto follow-ups", included: true },
      { text: "AI scheduling agent", included: true },
    ],
    cta: "Start Lease",
    ctaVariant: "command",
  },
  {
    name: "Full Ownership",
    price: "Custom",
    period: "quote",
    description: "Own the entire Genesis CRM platform outright. Your code, your servers, your business — forever.",
    badge: "Best Value",
    isOwnership: true,
    ctaLink: "/contact",
    features: [
      { text: "White-label branding", included: true },
      { text: "Custom domain", included: true },
      { text: "Unlimited leads", included: true },
      { text: "All AI agents included", included: true },
      { text: "Full source code ownership", included: true },
      { text: "Email + SMS + calls", included: true },
      { text: "Auto follow-ups", included: true },
      { text: "AI scheduling agent", included: true },
    ],
    cta: "Contact Us",
    ctaVariant: "outline",
  },
  {
    name: "Custom Enterprise",
    price: "$14,000+",
    period: "one-time",
    description: "Full ownership plus custom features built for your specific business needs and workflows.",
    badge: "Tailored",
    isOwnership: true,
    ctaLink: "/contact",
    features: [
      { text: "Everything in Full Ownership", included: true },
      { text: "Custom feature development", included: true },
      { text: "Bespoke AI agent workflows", included: true },
      { text: "Custom integrations", included: true },
      { text: "Dedicated onboarding", included: true },
      { text: "Priority support", included: true },
      { text: "Architecture consulting", included: true },
      { text: "Ongoing maintenance options", included: true },
    ],
    cta: "Contact Us",
    ctaVariant: "outline",
  },
];

function TierCard({
  tier,
  onCheckout,
}: {
  tier: PricingTier;
  onCheckout: (tier: PricingTier) => void;
}) {
  // Live price = baked-in tier.price unless an admin override has synced it to Stripe.
  const [displayedPrice, setDisplayedPrice] = useState(() =>
    getDisplayedPrice(tier.stripePriceId, tier.price),
  );
  const overridden = displayedPrice !== tier.price;

  useEffect(() => {
    const sync = () => setDisplayedPrice(getDisplayedPrice(tier.stripePriceId, tier.price));
    sync();
    window.addEventListener("vireon:pricing-overrides-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vireon:pricing-overrides-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [tier.stripePriceId, tier.price]);

  return (
    <div
      className={`relative rounded-2xl border p-6 transition-all ${
        tier.highlighted
          ? "border-primary/40 bg-primary/5 shadow-xl shadow-primary/10"
          : tier.isOwnership
            ? "border-accent/30 bg-accent/5 hover:border-accent/50"
            : "border-border bg-card hover:border-primary/20"
      }`}
    >
      {tier.badge && (
        <div className="absolute -top-3 left-6">
          <Badge variant={tier.highlighted ? "default" : tier.isOwnership ? "warning" : "info"} className="gap-1">
            {tier.highlighted && <Sparkles className="h-3 w-3" />}
            {tier.isOwnership && <Crown className="h-3 w-3" />}
            {tier.badge}
          </Badge>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-base font-semibold text-foreground">{tier.name}</h3>
        {(() => {
          const discounted = applyPromoDiscount(displayedPrice);
          const isCustomQuote = displayedPrice.toLowerCase() === "custom";
          if (discounted) {
            return (
              <>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-foreground">{discounted}</span>
                  <span className="text-xs text-muted-foreground">{tier.period}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground line-through">{displayedPrice}</span>
                  <Badge variant="warning" className="text-[10px] px-1.5 py-0">25% OFF</Badge>
                  {overridden && (
                    <Badge variant="info" className="text-[10px] px-1.5 py-0">Synced from Stripe</Badge>
                  )}
                </div>
              </>
            );
          }
          return (
            <>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">{displayedPrice}</span>
                <span className="text-xs text-muted-foreground">{tier.period}</span>
              </div>
              {isCustomQuote && (
                <div className="mt-1">
                  <Badge variant="warning" className="text-[10px] px-1.5 py-0">25% OFF QUOTE</Badge>
                </div>
              )}
              {overridden && !isCustomQuote && (
                <div className="mt-1">
                  <Badge variant="info" className="text-[10px] px-1.5 py-0">Synced from Stripe</Badge>
                </div>
              )}
            </>
          );
        })()}
        {tier.setupFee && (
          <p className="mt-1 text-xs font-medium text-primary/80">{tier.setupFee}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{tier.description}</p>
      </div>

      {tier.ctaLink ? (
        <Link to={tier.ctaLink}>
          <Button variant={tier.ctaVariant} className="w-full gap-2" size="sm">
            {tier.cta}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      ) : (
        <Button
          variant={tier.ctaVariant}
          className="w-full gap-2"
          size="sm"
          onClick={() => onCheckout(tier)}
        >
          {tier.cta}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}

      <div className="mt-6 space-y-2.5 border-t border-border pt-6">
        {tier.features.map((feature) => (
          <div key={feature.text} className="flex items-center gap-2">
            {feature.included ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-success" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            )}
            <span
              className={`text-xs ${
                feature.included ? "text-foreground" : "text-muted-foreground/50"
              }`}
            >
              {feature.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingCards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, CheckoutDialog } = useStripeCheckout();

  const handleCheckout = (tier: PricingTier) => {
    if (!tier.stripePriceId) return;
    if (!user) {
      navigate({ to: "/signup", search: { plan: tier.stripePriceId } as never });
      return;
    }
    openCheckout({
      mode: "price",
      priceId: tier.stripePriceId,
      customerEmail: user.email,
      userId: user.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  return (
    <div className="space-y-20">
      {/* CRM Plans — for businesses that just want the CRM */}
      <div>
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-3 gap-1.5 text-sm px-4 py-1">
            <Monitor className="h-4 w-4" /> Done-For-You CRM
          </Badge>
          <h2 className="text-2xl font-bold text-foreground">CRM Plans</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We build, host, and maintain your CRM — you just use it. Setup fees invoiced separately.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-4">
          {crmTiers.map((tier) => (
            <TierCard key={tier.name} tier={tier} onCheckout={handleCheckout} />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* White-Label Plans — for resellers */}
      <div>
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-3 gap-1.5 text-sm px-4 py-1">
            <Building2 className="h-4 w-4" /> White-Label
          </Badge>
          <h2 className="text-2xl font-bold text-foreground">White-Label Plans</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Resell the CRM under your own brand. Your logo, your domain, your clients.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-4">
          {whiteLabelTiers.map((tier) => (
            <TierCard key={tier.name} tier={tier} onCheckout={handleCheckout} />
          ))}
        </div>
      </div>

      {/* Lead-finder pricing & BYO API key disclosure */}
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15">
            <Key className="h-4 w-4 text-warning" />
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Auto Find Leads — Bring Your Own API Key
                <Badge variant="warning" className="text-[10px]">Required</Badge>
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Lead discovery (Apollo, Hunter, Snov, and other providers) is <strong>not included</strong> in any
                plan. These are third-party data services with their own pricing — you must sign up directly with
                each provider and connect your own API key inside the CRM's Integrations settings.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <p className="text-xs font-medium text-foreground">Apollo.io</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Free tier available · Paid plans from ~$49/mo</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <p className="text-xs font-medium text-foreground">Hunter.io</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Free tier available · Paid plans from ~$34/mo</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <p className="text-xs font-medium text-foreground">Snov.io</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Free tier available · Paid plans from ~$39/mo</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
              <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Pricing shown is indicative and set by each provider — check their site for current rates. We never
                charge or mark up usage; your API key is billed directly by the provider. The CRM only orchestrates
                the searches and imports the results into your pipeline.
              </p>
            </div>
          </div>
        </div>
      </div>

      {CheckoutDialog}
    </div>
  );
}
