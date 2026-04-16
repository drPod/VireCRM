import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — Vireon" },
      { name: "description", content: "Terms and conditions governing your use of the Vireon platform." },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 pt-24 pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: April 16, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
              <p className="mt-2">
                By accessing or using Vireon (the "<strong>Service</strong>"), operated by [Your Business Name], you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
              <p className="mt-2">
                Vireon is an AI-powered CRM platform that helps businesses automate sales processes, manage leads, and conduct outreach campaigns. Features vary by subscription plan.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Account Registration</h2>
              <p className="mt-2">
                You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Payments &amp; Billing</h2>
              <p className="mt-2">
                Paid plans are billed on a recurring basis (monthly or annually) as specified at the time of purchase. All payments are processed by <strong>Paddle.com Market Limited</strong> (for customers outside the USA) and <strong>Paddle.com Inc.</strong> (for customers in the USA), who act as our Merchant of Record. All billing inquiries and payment disputes should be directed to Paddle.
              </p>
              <p className="mt-2">
                By subscribing, you authorize Paddle to charge the applicable fees to your chosen payment method. Prices are listed in USD and may vary by region due to localized pricing.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Subscriptions &amp; Cancellation</h2>
              <p className="mt-2">
                You may cancel your subscription at any time through the customer portal. Upon cancellation, you retain access to paid features until the end of your current billing period. No partial refunds are issued for unused time within a billing period.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Free Trial</h2>
              <p className="mt-2">
                New users may receive a 14-day free trial. At the end of the trial period, your account will revert to a free tier unless you choose a paid plan. No payment is required during the trial.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Acceptable Use</h2>
              <p className="mt-2">You agree not to:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Use the Service for any unlawful purpose or to send unsolicited communications (spam).</li>
                <li>Attempt to gain unauthorized access to any part of the Service.</li>
                <li>Interfere with the operation of the Service or other users' access.</li>
                <li>Reverse engineer, decompile, or disassemble the Service.</li>
                <li>Use the Service to store or transmit malicious code.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Intellectual Property</h2>
              <p className="mt-2">
                All content, features, and functionality of the Service are owned by [Your Business Name] and are protected by intellectual property laws. Your data remains yours — we claim no ownership over content you upload.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Limitation of Liability</h2>
              <p className="mt-2">
                To the maximum extent permitted by law, [Your Business Name] shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Termination</h2>
              <p className="mt-2">
                We may suspend or terminate your access if you violate these Terms. Upon termination, your right to use the Service ceases immediately. You may export your data before termination.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">11. Changes to These Terms</h2>
              <p className="mt-2">
                We reserve the right to modify these Terms at any time. Material changes will be communicated via email or a notice on the Service. Continued use after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">12. Contact</h2>
              <p className="mt-2">
                For questions about these Terms, contact us at{" "}
                <a href="mailto:legal@vireon.com" className="text-primary hover:underline">legal@vireon.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
