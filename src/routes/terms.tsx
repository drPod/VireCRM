import { createFileRoute } from "@tanstack/react-router";
import { useCustomDomainGuard } from "@/hooks/useCustomDomainGuard";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/config/support";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions — GenesisX CRM" },
      {
        name: "description",
        content:
          "GenesisX CRM Software Terms & Conditions Agreement governing your use of the platform.",
      },
      { property: "og:title", content: "Terms & Conditions — Genesis" },
      {
        property: "og:description",
        content: "Terms governing your use of the Genesis CRM platform.",
      },
      { property: "og:url", content: "https://genesisx.space/terms" },
    ],
    links: [{ rel: "canonical", href: "https://genesisx.space/terms" }],
  }),
});

function TermsPage() {
  if (useCustomDomainGuard()) return null;
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 pt-12 pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-3xl font-bold text-foreground">
            GenesisX CRM Software Terms &amp; Conditions Agreement
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Effective Date: April 22, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
              <p className="mt-2">
                By accessing or using the GenesisX CRM platform (&ldquo;Service&rdquo;), you agree
                to be bound by this Agreement. If you do not agree to these Terms &amp; Conditions,
                you may not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
              <p className="mt-2">
                GenesisX provides a customer relationship management (CRM) platform designed to
                assist with lead management, automation, communication workflows, and related
                business operations.
              </p>
              <p className="mt-2">
                We reserve the right to modify, update, or discontinue any part of the Service at
                any time without notice.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                3. &ldquo;As-Is&rdquo; and &ldquo;As-Available&rdquo; Disclaimer
              </h2>
              <p className="mt-2">
                The Service is provided on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo;
                basis without warranties of any kind, whether express or implied.
              </p>
              <p className="mt-2">GenesisX does not guarantee that the Service will be:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Uninterrupted</li>
                <li>Error-free</li>
                <li>Secure</li>
                <li>Free from bugs or harmful components</li>
              </ul>
              <p className="mt-2">Your use of the Service is at your own risk.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                4. Bug &amp; Error Acknowledgement
              </h2>
              <p className="mt-2">
                You acknowledge that software may contain bugs, errors, or unexpected behavior.
              </p>
              <p className="mt-2">
                GenesisX shall not be held liable for any damages, losses, or issues arising from
                such bugs or errors.
              </p>
              <p className="mt-2">
                However, GenesisX agrees to make commercially reasonable efforts to investigate and
                fix reported issues within a reasonable timeframe.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Limitation of Liability</h2>
              <p className="mt-2">
                To the fullest extent permitted by law, GenesisX shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages, including but not
                limited to:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Loss of profits</li>
                <li>Loss of revenue</li>
                <li>Loss of data</li>
                <li>Business interruption</li>
                <li>Loss of business opportunities</li>
              </ul>
              <p className="mt-2">
                In all cases, GenesisX&apos;s total liability shall not exceed the amount paid by
                you for the Service within the thirty (30) days prior to the claim.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. User Responsibilities</h2>
              <p className="mt-2">You are solely responsible for:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>The accuracy and legality of all data entered into the system</li>
                <li>Maintaining backups of your data</li>
                <li>Reviewing and approving communications before sending</li>
                <li>
                  Ensuring compliance with all applicable laws (including marketing and data laws)
                </li>
              </ul>
              <p className="mt-2">
                GenesisX is not responsible for user misuse, user error, or improper implementation.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                7. Payments &amp; No Refund Policy
              </h2>
              <p className="mt-2">
                All payments made to GenesisX are final and non-refundable, unless otherwise
                explicitly agreed to in writing.
              </p>
              <p className="mt-2">
                Due to the digital nature of the Service and immediate access upon purchase, you
                acknowledge and agree that:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>No refunds will be issued once access has been granted</li>
                <li>No refunds will be issued for partial use or lack of use</li>
                <li>No refunds will be issued due to dissatisfaction</li>
                <li>
                  No refunds will be issued due to bugs, errors, or temporary service interruptions
                </li>
              </ul>
              <p className="mt-2">
                GenesisX will make reasonable efforts to fix issues, but technical problems do not
                qualify for refunds.
              </p>
              <p className="mt-2">
                By purchasing and using the Service, you fully agree to this No Refund Policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Data &amp; Privacy</h2>
              <p className="mt-2">
                While GenesisX implements reasonable security measures, you acknowledge that no
                system is completely secure.
              </p>
              <p className="mt-2">GenesisX is not responsible for:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Data loss</li>
                <li>Unauthorized access caused by user negligence</li>
                <li>Third-party breaches outside of our control</li>
              </ul>
              <p className="mt-2">
                You are responsible for protecting your login credentials and sensitive data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Service Availability</h2>
              <p className="mt-2">
                GenesisX does not guarantee continuous or uninterrupted access to the Service.
                Downtime may occur due to:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Maintenance</li>
                <li>System updates</li>
                <li>Server issues</li>
                <li>External or unforeseen circumstances</li>
              </ul>
              <p className="mt-2">
                GenesisX shall not be held liable for any losses resulting from downtime.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Indemnification</h2>
              <p className="mt-2">
                You agree to indemnify, defend, and hold harmless GenesisX, its owners, affiliates,
                and partners from any claims, damages, liabilities, or legal disputes arising from:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any laws or third-party rights</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                11. Modifications to Agreement
              </h2>
              <p className="mt-2">
                GenesisX reserves the right to update or modify these Terms at any time. Continued
                use of the Service after changes constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">12. Governing Law</h2>
              <p className="mt-2">
                This Agreement shall be governed by and interpreted in accordance with the laws of
                the State of Texas, United States, without regard to conflict of law principles.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">13. Contact &amp; Support</h2>
              <p className="mt-2">
                For all questions, support requests, or concerns, you may contact:
              </p>
              <p className="mt-2">
                Email:{" "}
                <a href={SUPPORT_MAILTO} className="text-primary hover:underline">
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <p className="mt-2">
                GenesisX will make reasonable efforts to respond in a timely manner.
              </p>
            </section>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
