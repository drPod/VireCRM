import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export const Route = createFileRoute("/refund-policy")({
  component: RefundPolicyPage,
  head: () => ({
    meta: [
      { title: "Refund Policy — Vireon" },
      { name: "description", content: "Vireon's refund policy for subscription plans and purchases." },
    ],
  }),
});

function RefundPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 pt-24 pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-3xl font-bold text-foreground">Refund Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: April 16, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">Overview</h2>
              <p className="mt-2">
                We want you to be satisfied with Vireon. If you're not happy with your purchase, we offer a straightforward refund policy as outlined below.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">30-Day Money-Back Guarantee</h2>
              <p className="mt-2">
                If you are unsatisfied with Vireon for any reason, you may request a full refund within <strong>30 days</strong> of your initial purchase. This applies to the first payment of new subscriptions only.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">How to Request a Refund</h2>
              <p className="mt-2">To request a refund:</p>
              <ol className="mt-2 list-decimal pl-6 space-y-1">
                <li>
                  Email us at{" "}
                  <a href="mailto:support@vireon.com" className="text-primary hover:underline">support@vireon.com</a>{" "}
                  with the subject line "Refund Request".
                </li>
                <li>Include your account email address and the reason for your refund.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Processing</h2>
              <p className="mt-2">
                Refunds are processed by our payment processor. Once approved, refunds are typically returned to the original payment method within 5–10 business days, depending on your financial institution.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">What Is Not Refundable</h2>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Renewal payments beyond the initial 30-day window.</li>
                <li>Partial billing periods after cancellation (you retain access until the end of your current period).</li>
                <li>White-label ownership fees (one-time purchases are final after the 30-day window).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Cancellation</h2>
              <p className="mt-2">
                You can cancel your subscription at any time through the customer portal. Cancellation takes effect at the end of your current billing period — you'll continue to have access until then. No further charges will be made after cancellation.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">Contact Us</h2>
              <p className="mt-2">
                If you have questions about our refund policy, please contact us at{" "}
                <a href="mailto:support@vireon.com" className="text-primary hover:underline">support@vireon.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
