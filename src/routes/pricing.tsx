import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PricingCards } from "@/components/marketing/PricingCards";
import { CtaSection } from "@/components/marketing/CtaSection";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — AI CRM" },
      { name: "description", content: "Choose the perfect AI CRM plan for your team. Starter, Professional, or Enterprise with white-labeling." },
      { property: "og:title", content: "AI CRM Pricing — Plans for Every Team" },
      { property: "og:description", content: "From $49/mo for small teams to unlimited Enterprise with white-label. Start your free trial today." },
    ],
  }),
});

function PricingPage() {
  return (
    <div className="min-h-screen">
      <MarketingHeader />

      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h1 className="text-4xl font-bold text-foreground">
              Simple, Transparent Pricing
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Start free for 14 days. No credit card required. Upgrade as you grow.
            </p>
          </div>

          <PricingCards />

          {/* FAQ */}
          <div className="mx-auto mt-20 max-w-2xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {[
                {
                  q: "What's included in the free trial?",
                  a: "Full access to your chosen plan's features for 14 days. No credit card required. You can upgrade, downgrade, or cancel anytime.",
                },
                {
                  q: "What does white-label mean?",
                  a: "Enterprise plans let you rebrand the entire CRM with your own logo, colors, domain, and company name. Sell it as your own product to your clients.",
                },
                {
                  q: "How does AI lead scoring work?",
                  a: "Our AI analyzes lead behavior, engagement, company data, and historical patterns to assign a conversion probability score from 0-100.",
                },
                {
                  q: "Can I switch plans later?",
                  a: "Absolutely. Upgrade or downgrade anytime. Changes take effect on your next billing cycle with prorated adjustments.",
                },
              ].map((faq) => (
                <div key={faq.q} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground">{faq.q}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CtaSection />
      <MarketingFooter />
    </div>
  );
}
