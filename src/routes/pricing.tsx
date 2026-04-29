import { createFileRoute } from "@tanstack/react-router";
import { useCustomDomainGuard } from "@/hooks/useCustomDomainGuard";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PricingCards } from "@/components/marketing/PricingCards";
import { CtaSection } from "@/components/marketing/CtaSection";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/config/support";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — Genesis CRM" },
      { name: "description", content: "Done-for-you CRM plans from $97/mo or white-label plans to resell under your brand." },
      { property: "og:title", content: "Genesis Pricing — Plans That Fit Your Business" },
      { property: "og:description", content: "CRM plans from $97/mo. White-label from $249/mo. Custom builds from $10K." },
    ],
  }),
});

function PricingPage() {
  if (useCustomDomainGuard()) return null;
  return (
    <div className="min-h-screen">
      <PaymentTestModeBanner />
      <MarketingHeader />

      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h1 className="text-4xl font-bold text-foreground">
              Plans That Fit Your Business
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Just need a CRM? We'll build and run it for you. Want to resell it? Go white-label.
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
                  q: "What's the difference between CRM plans and white-label plans?",
                  a: "CRM plans are for businesses that just want a CRM to manage their own sales. White-label plans let you resell the CRM under your own brand to your clients.",
                },
                {
                  q: "What are the setup fees?",
                  a: "Setup fees cover custom configuration, onboarding, and initial data migration. They're invoiced separately after a discovery call — not charged at checkout.",
                },
                {
                  q: "What does white-label mean?",
                  a: "Your logo, your colors, your domain, your brand. Your clients will never know it's built by us. White-label plans include full rebranding.",
                },
                {
                  q: "Can I upgrade from a CRM plan to white-label?",
                  a: "Yes! Contact us and we'll help you transition. We'll credit a portion of your existing payments toward the upgrade.",
                },
                {
                  q: "What's the Custom CRM build?",
                  a: "A fully bespoke system starting at $10K — tailored workflows, unique dashboards, and integrations built specifically for your business. Contact us to discuss your needs.",
                },
                {
                  q: "Why are Custom CRM and Full Ownership invoiced after a call instead of using Stripe checkout?",
                  a: "These tiers are bespoke engagements, not fixed SaaS subscriptions. Before we charge anything, we run a short discovery call to confirm scope (workflows, integrations, source-code handoff, ownership terms), agree on the final price, and prepare a written statement of work. Once that's signed, we send a secure Stripe invoice — so you only pay for exactly what was scoped, with a paper trail. Charging $7K+ through a public self-serve button without that conversation would be the suspicious move; an invoice tied to a signed SOW is the standard, safe way to do high-ticket custom work.",
                },
                {
                  q: "How do I reach you?",
                  a: (
                    <>
                      Call or text us at{" "}
                      <a href="tel:+19403656600" className="font-medium text-primary hover:underline">
                        +1 (940) 365-6600
                      </a>{" "}
                      or email{" "}
                      <a href={SUPPORT_MAILTO} className="font-medium text-primary hover:underline">
                        {SUPPORT_EMAIL}
                      </a>
                      . We typically reply within one business day.
                    </>
                  ),
                },
              ].map((faq) => (
                <div key={faq.q} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground">{faq.q}</h3>
                  <div className="mt-2 text-sm text-muted-foreground">{faq.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Direct contact strip — phone + email for high-ticket tier prospects */}
      <section className="border-t border-border bg-card/30 py-12">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-xl font-bold text-foreground">Talk to a human about Custom CRM or Full Ownership</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Skip the form — call, text, or email us directly to book a discovery call.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="tel:+19403656600"
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-primary/20 transition-colors"
            >
              📞 +1 (940) 365-6600
            </a>
            <a
              href={SUPPORT_MAILTO}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors"
            >
              ✉️ {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <CtaSection />
      <MarketingFooter />
    </div>
  );
}
