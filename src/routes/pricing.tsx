import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PricingCards } from "@/components/marketing/PricingCards";
import { CtaSection } from "@/components/marketing/CtaSection";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — White-Label AI CRM" },
      { name: "description", content: "Lease or own a white-label AI CRM. From $249/mo leasing to $10,000 full ownership." },
      { property: "og:title", content: "White-Label AI CRM Pricing — Lease or Own" },
      { property: "og:description", content: "Lease from $249/mo or own outright for $10,000. Full white-label branding, AI agents, and source code." },
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
              Lease It or Own It
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              White-label AI CRM — run it as your own business. Choose monthly leasing or full ownership.
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
                  q: "What's the difference between leasing and ownership?",
                  a: "Leasing gives you a fully branded white-label CRM on our infrastructure for a monthly fee. Ownership gives you the complete source code, database, and infrastructure — it's yours forever with no recurring costs.",
                },
                {
                  q: "What does white-label mean?",
                  a: "Every plan includes full white-labeling. Your logo, your colors, your domain, your brand. Your clients will never know it's built by us.",
                },
                {
                  q: "What's included in the $14K custom option?",
                  a: "Everything in Full Ownership plus custom features tailored to your business — bespoke AI workflows, custom integrations, dedicated onboarding, and architecture consulting.",
                },
                {
                  q: "Can I upgrade from lease to ownership?",
                  a: "Yes! Contact us and we'll credit a portion of your lease payments toward the ownership price.",
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
