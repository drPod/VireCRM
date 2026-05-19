import { createFileRoute } from "@tanstack/react-router";
import { useCustomDomainGuard } from "@/hooks/useCustomDomainGuard";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PricingCards } from "@/components/marketing/PricingCards";
import { CtaSection } from "@/components/marketing/CtaSection";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/config/support";
import { Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — VireCRM" },
      {
        name: "description",
        content: "Done-for-you CRM plans from $97/mo. Custom builds available — talk to sales.",
      },
      { property: "og:title", content: "VireCRM Pricing — Plans That Fit Your Business" },
      {
        property: "og:description",
        content: "CRM plans from $97/mo. Custom builds — talk to sales.",
      },
      { property: "og:url", content: "https://virecrm.com/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://virecrm.com/pricing" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What are the setup fees?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Setup fees cover custom configuration, onboarding, and initial data migration. They're invoiced separately after a discovery call — not charged at checkout.",
              },
            },
            {
              "@type": "Question",
              name: "What's the Custom plan?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "A bespoke engagement — tailored workflows, dedicated migration, and white-glove onboarding built specifically for your business. Pricing scoped after a short discovery call.",
              },
            },
            {
              "@type": "Question",
              name: "How do I reach you?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Call or text us at +1 (940) 365-6600 or email support@virecrm.com. We typically reply within one business day.",
              },
            },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "VireCRM",
          url: "https://virecrm.com/pricing",
          telephone: "+1-940-365-6600",
          email: "support@virecrm.com",
          priceRange: "$97-$297",
        }),
      },
    ],
  }),
});

function PricingPage() {
  if (useCustomDomainGuard()) return null;
  return (
    <div className="min-h-screen">
      <MarketingHeader />

      <section className="pt-12 pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h1 className="text-4xl font-bold text-foreground">Plans That Fit Your Business</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              We'll build, host, and run your CRM. Pick a plan or talk to sales for a custom build.
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
                  q: "What are the setup fees?",
                  a: "Setup fees cover custom configuration, onboarding, and initial data migration. They're invoiced separately after a discovery call — not charged at checkout.",
                },
                {
                  q: "What's the Custom plan?",
                  a: "A bespoke engagement — tailored workflows, dedicated migration, and white-glove onboarding built specifically for your business. Pricing scoped after a short discovery call.",
                },
                {
                  q: "Why is the Custom plan invoiced after a call instead of using Stripe checkout?",
                  a: "Bespoke engagements aren't fixed SaaS subscriptions. Before we charge anything, we run a short discovery call to confirm scope (workflows, integrations, migration plan), agree on the final price, and prepare a written statement of work. Once that's signed, we send a secure Stripe invoice — so you only pay for exactly what was scoped, with a paper trail.",
                },
                {
                  q: "How do I reach you?",
                  a: (
                    <>
                      Call or text us at{" "}
                      <a
                        href="tel:+19403656600"
                        className="font-medium text-primary hover:underline"
                      >
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
          <h2 className="text-xl font-bold text-foreground">
            Talk to a human about a Custom build
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Skip the form — call, text, or email us directly to book a discovery call.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="tel:+19403656600"
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-primary/20 transition-colors"
            >
              <Phone className="h-4 w-4" aria-hidden="true" /> +1 (940) 365-6600
            </a>
            <a
              href={SUPPORT_MAILTO}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors"
            >
              <Mail className="h-4 w-4" aria-hidden="true" /> {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <CtaSection />
      <MarketingFooter />
    </div>
  );
}
