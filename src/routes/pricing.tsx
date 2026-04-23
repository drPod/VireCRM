import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PricingCards } from "@/components/marketing/PricingCards";
import { CtaSection } from "@/components/marketing/CtaSection";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Button } from "@/components/ui/button";

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
            <div className="mt-6 flex justify-center">
              <Button asChild size="lg" variant="outline" className="gap-2">
                <a
                  href="/sales-pitch-guide.pdf"
                  download="genesis-sales-pitch-guide.pdf"
                >
                  <Download className="h-4 w-4" />
                  Download the Sales Pitch Guide (PDF)
                </a>
              </Button>
            </div>
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
