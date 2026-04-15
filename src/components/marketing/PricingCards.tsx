import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight, Sparkles, Crown, Building2 } from "lucide-react";

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
  ctaLink: string;
  isOwnership?: boolean;
}

export const pricingTiers: PricingTier[] = [
  {
    name: "Lease — Starter",
    price: "$249",
    period: "/month",
    description: "White-label AI CRM leased to your business. Full branding, your domain, your clients.",
    features: [
      { text: "White-label branding", included: true },
      { text: "Custom domain", included: true },
      { text: "Up to 2,000 leads", included: true },
      { text: "Pipeline management", included: true },
      { text: "Email outreach", included: true },
      { text: "AI lead scoring", included: true },
      { text: "Activity tracking", included: true },
      { text: "AI reply classification", included: true },
      { text: "AI message generation", included: false },
      { text: "Auto follow-ups", included: false },
      { text: "AI scheduling agent", included: false },
      { text: "Full source code", included: false },
    ],
    cta: "Start Lease",
    ctaVariant: "outline",
    ctaLink: "/signup",
  },
  {
    name: "Lease — Professional",
    price: "$849",
    period: "/month",
    description: "Full-featured white-label CRM with all AI agents. Scale your sales operation.",
    badge: "Most Popular",
    highlighted: true,
    features: [
      { text: "White-label branding", included: true },
      { text: "Custom domain", included: true },
      { text: "Up to 25,000 leads", included: true },
      { text: "Pipeline management", included: true },
      { text: "Email + SMS outreach", included: true },
      { text: "AI lead scoring", included: true },
      { text: "Activity tracking", included: true },
      { text: "AI reply classification", included: true },
      { text: "AI message generation", included: true },
      { text: "Auto follow-ups", included: true },
      { text: "AI scheduling agent", included: true },
      { text: "Full source code", included: false },
    ],
    cta: "Start Lease",
    ctaVariant: "command",
    ctaLink: "/signup",
  },
  {
    name: "Full Ownership",
    price: "$10,000",
    period: "one-time",
    description: "Own the entire AI CRM platform outright. Your code, your servers, your business — forever.",
    badge: "Best Value",
    isOwnership: true,
    features: [
      { text: "White-label branding", included: true },
      { text: "Custom domain", included: true },
      { text: "Unlimited leads", included: true },
      { text: "Pipeline management", included: true },
      { text: "Email + SMS + calls", included: true },
      { text: "AI lead scoring", included: true },
      { text: "Activity tracking", included: true },
      { text: "AI reply classification", included: true },
      { text: "AI message generation", included: true },
      { text: "Auto follow-ups", included: true },
      { text: "AI scheduling agent", included: true },
      { text: "Full source code ownership", included: true },
    ],
    cta: "Buy Now",
    ctaVariant: "command",
    ctaLink: "/signup",
  },
  {
    name: "Custom Enterprise",
    price: "$14,000+",
    period: "one-time",
    description: "Full ownership plus custom features built for your specific business needs and workflows.",
    badge: "Tailored",
    isOwnership: true,
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
    ctaLink: "/contact",
  },
];

export function PricingCards() {
  return (
    <div className="space-y-10">
      {/* Category Labels */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="text-center">
          <Badge variant="secondary" className="mb-2 gap-1 text-xs">
            <Building2 className="h-3 w-3" /> Leasing
          </Badge>
          <p className="text-xs text-muted-foreground">Monthly subscription — we host and maintain</p>
        </div>
        <div className="text-center">
          <Badge variant="secondary" className="mb-2 gap-1 text-xs">
            <Crown className="h-3 w-3" /> Ownership
          </Badge>
          <p className="text-xs text-muted-foreground">One-time payment — you own everything</p>
        </div>
      </div>

      {/* All 4 tiers */}
      <div className="grid gap-6 lg:grid-cols-4">
        {pricingTiers.map((tier) => (
          <div
            key={tier.name}
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
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">{tier.price}</span>
                <span className="text-xs text-muted-foreground">{tier.period}</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{tier.description}</p>
            </div>

            {tier.ctaLink.startsWith("mailto:") ? (
              <a href={tier.ctaLink}>
                <Button variant={tier.ctaVariant} className="w-full gap-2" size="sm">
                  {tier.cta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            ) : (
              <Link to={tier.ctaLink}>
                <Button variant={tier.ctaVariant} className="w-full gap-2" size="sm">
                  {tier.cta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
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
        ))}
      </div>
    </div>
  );
}
