import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight, Sparkles, Crown, Monitor, Key, Info } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useNavigate } from "@tanstack/react-router";
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
    description:
      "Everything you need to get your sales system off the ground and stay organized from day one.",
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
    description:
      "Turn your CRM into a consistent revenue engine with automated outreach and pipeline optimization.",
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
    description:
      "Built for scaling teams that need serious automation, deep visibility, and enterprise-grade workflows.",
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
    name: "Custom",
    price: "Let's talk",
    period: "",
    description: "Custom builds, dedicated migration, white-glove onboarding.",
    badge: "Talk to sales",
    isOwnership: true,
    ctaLink: "/contact",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Bespoke workflows", included: true },
      { text: "Custom integrations", included: true },
      { text: "Dedicated migration", included: true },
      { text: "White-glove onboarding", included: true },
      { text: "Architecture consulting", included: true },
      { text: "Priority support", included: true },
      { text: "Ongoing maintenance options", included: true },
    ],
    cta: "Talk to sales",
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
    // TODO(rebrand): rename event in a follow-up — must change emitter + this listener atomically.
    window.addEventListener("majix:pricing-overrides-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("majix:pricing-overrides-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [tier.stripePriceId, tier.price]);

  return (
    <div
      className={`relative rounded-2xl border p-6 transition-[border-color,background-color] ${
        tier.highlighted
          ? "border-primary/40 bg-primary/5 shadow-xl shadow-primary/10"
          : tier.isOwnership
            ? "border-accent/30 bg-accent/5 hover:border-accent/50"
            : "border-border bg-card hover:border-primary/20"
      }`}
    >
      {tier.badge && (
        <div className="absolute -top-3 left-6">
          <Badge
            variant={tier.highlighted ? "default" : tier.isOwnership ? "warning" : "info"}
            className="gap-1"
          >
            {tier.highlighted && <Sparkles className="h-3 w-3" />}
            {tier.isOwnership && <Crown className="h-3 w-3" />}
            {tier.badge}
          </Badge>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-base font-semibold text-foreground">{tier.name}</h3>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-foreground tabular-nums">
            {displayedPrice}
          </span>
          <span className="text-xs text-muted-foreground">{tier.period}</span>
        </div>
        {overridden && (
          <div className="mt-1">
            <Badge variant="info" className="text-[10px] px-1.5 py-0">
              Synced from Stripe
            </Badge>
          </div>
        )}
        {tier.setupFee && (
          <p className="mt-1 text-xs font-medium text-primary/80">{tier.setupFee}</p>
        )}
        {tier.ctaLink === "/contact" && (
          <p className="mt-2 text-[11px] font-medium text-muted-foreground/80">
            Invoiced after a discovery call — never charged at checkout.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{tier.description}</p>
      </div>

      {tier.ctaLink ? (
        // Talk-to-sales / contact-us tiers route to the in-site contact form
        // so prospects stay on the site and email us instead of being kicked
        // out to the phone dialer.
        <Button asChild variant={tier.ctaVariant} className="w-full gap-2" size="sm">
          <Link to={tier.ctaLink}>
            {tier.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
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
          <p className="mt-2 text-xs text-muted-foreground">All prices in USD.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-4">
          {crmTiers.map((tier) => (
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
                <Badge variant="warning" className="text-[10px]">
                  Required
                </Badge>
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Lead discovery (Apollo, Hunter, Snov, and other providers) is{" "}
                <strong>not included</strong> in any plan. These are third-party data services with
                their own pricing — you must sign up directly with each provider and connect your
                own API key inside the CRM's Integrations settings.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <p className="text-xs font-medium text-foreground">Apollo.io</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Free tier available · Paid plans from ~$49/mo
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <p className="text-xs font-medium text-foreground">Hunter.io</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Free tier available · Paid plans from ~$34/mo
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <p className="text-xs font-medium text-foreground">Snov.io</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Free tier available · Paid plans from ~$39/mo
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
              <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Pricing shown is indicative and set by each provider — check their site for current
                rates. We never charge or mark up usage; your API key is billed directly by the
                provider. The CRM only orchestrates the searches and imports the results into your
                pipeline.
              </p>
            </div>
          </div>
        </div>
      </div>

      {CheckoutDialog}
    </div>
  );
}
