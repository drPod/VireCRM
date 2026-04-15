import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";

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
}

export const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "Essential CRM tools for small teams getting started with AI-powered sales.",
    features: [
      { text: "Up to 500 leads", included: true },
      { text: "Pipeline management", included: true },
      { text: "Email outreach", included: true },
      { text: "Basic lead scoring", included: true },
      { text: "Activity tracking", included: true },
      { text: "AI reply classification", included: false },
      { text: "AI message generation", included: false },
      { text: "Auto follow-ups", included: false },
      { text: "AI scheduling agent", included: false },
      { text: "White-label branding", included: false },
      { text: "API access", included: false },
    ],
    cta: "Start Free Trial",
    ctaVariant: "outline",
  },
  {
    name: "Professional",
    price: "$149",
    period: "/month",
    description: "Full AI automation suite for growing sales teams that want to 3x output.",
    badge: "Most Popular",
    highlighted: true,
    features: [
      { text: "Up to 5,000 leads", included: true },
      { text: "Pipeline management", included: true },
      { text: "Email + SMS outreach", included: true },
      { text: "AI lead scoring", included: true },
      { text: "Activity tracking", included: true },
      { text: "AI reply classification", included: true },
      { text: "AI message generation", included: true },
      { text: "Auto follow-ups", included: true },
      { text: "AI scheduling agent", included: false },
      { text: "White-label branding", included: false },
      { text: "API access", included: false },
    ],
    cta: "Start Free Trial",
    ctaVariant: "command",
  },
  {
    name: "Enterprise",
    price: "$399",
    period: "/month",
    description: "Unlimited AI power with white-labeling. Sell AI CRM as your own product.",
    badge: "White-Label",
    features: [
      { text: "Unlimited leads", included: true },
      { text: "Pipeline management", included: true },
      { text: "Email + SMS + calls", included: true },
      { text: "AI lead scoring", included: true },
      { text: "Activity tracking", included: true },
      { text: "AI reply classification", included: true },
      { text: "AI message generation", included: true },
      { text: "Auto follow-ups", included: true },
      { text: "AI scheduling agent", included: true },
      { text: "White-label branding", included: true },
      { text: "API access", included: true },
    ],
    cta: "Contact Sales",
    ctaVariant: "outline",
  },
];

export function PricingCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {pricingTiers.map((tier) => (
        <div
          key={tier.name}
          className={`relative rounded-2xl border p-8 transition-all ${
            tier.highlighted
              ? "border-primary/40 bg-primary/5 shadow-xl shadow-primary/10"
              : "border-border bg-card hover:border-primary/20"
          }`}
        >
          {tier.badge && (
            <div className="absolute -top-3 left-6">
              <Badge variant={tier.highlighted ? "default" : "info"} className="gap-1">
                {tier.highlighted && <Sparkles className="h-3 w-3" />}
                {tier.badge}
              </Badge>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">{tier.price}</span>
              <span className="text-sm text-muted-foreground">{tier.period}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{tier.description}</p>
          </div>

          <Link to="/signup">
            <Button
              variant={tier.ctaVariant}
              className="w-full gap-2"
            >
              {tier.cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          <div className="mt-6 space-y-3 border-t border-border pt-6">
            {tier.features.map((feature) => (
              <div key={feature.text} className="flex items-center gap-2.5">
                {feature.included ? (
                  <Check className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                )}
                <span
                  className={`text-sm ${
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
  );
}
