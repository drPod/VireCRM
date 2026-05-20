import { createFileRoute } from "@tanstack/react-router";
import { useCustomDomainGuard } from "@/hooks/useCustomDomainGuard";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions — VireCRM" },
      {
        name: "description",
        content:
          "VireCRM Software Terms & Conditions Agreement governing your use of the platform.",
      },
      { property: "og:title", content: "Terms & Conditions — VireCRM" },
      {
        property: "og:description",
        content: "Terms governing your use of the VireCRM platform.",
      },
      { property: "og:url", content: "https://virecrm.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://virecrm.com/terms" }],
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
            VireCRM Terms &amp; Conditions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Effective: May 20, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
              <p className="mt-2">
                By accessing or using VireCRM (&ldquo;Service&rdquo;, &ldquo;platform&rdquo;), you
                agree to be bound by these Terms &amp; Conditions (&ldquo;Terms&rdquo;) and our{" "}
                <a href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                . If you do not agree to these Terms, you may not use the Service.
              </p>
              <p className="mt-2">
                The Service is operated by Darsh Poddar, an individual. References to
                &ldquo;VireCRM&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo; in
                these Terms refer to Darsh Poddar as the operator of VireCRM.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
              <p className="mt-2">
                VireCRM is a multi-tenant, white-label customer relationship management (CRM) SaaS
                platform. The Service provides tools for lead management, contact tracking,
                pipeline management, communication workflows, appointment scheduling, campaign
                automation, and related business operations.
              </p>
              <p className="mt-2">
                Each customer organization receives an isolated tenant environment. Paid tiers
                include a custom subdomain (<em>&lt;slug&gt;.virecrm.com</em>) and optional
                custom hostname support.
              </p>
              <p className="mt-2">
                We reserve the right to modify, update, or discontinue any part of the Service at
                any time. We will provide reasonable notice of material changes where practicable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Account Responsibilities</h2>
              <p className="mt-2">You agree to:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Provide accurate and complete information when creating your account.</li>
                <li>
                  Maintain the confidentiality of your login credentials and be responsible for all
                  activity that occurs under your account.
                </li>
                <li>
                  Notify us immediately at{" "}
                  <a href="mailto:darsh.pod@gmail.com" className="text-primary hover:underline">
                    darsh.pod@gmail.com
                  </a>{" "}
                  if you suspect unauthorized access to your account.
                </li>
                <li>
                  Not share your account credentials with individuals outside your organization.
                </li>
              </ul>
              <p className="mt-2">
                You are responsible for all actions taken under your account, including actions
                taken by team members you invite.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use</h2>
              <p className="mt-2">You agree not to use the Service to:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>
                  Send spam, unsolicited bulk communications, or messages that violate applicable
                  law (including CAN-SPAM, TCPA, or GDPR).
                </li>
                <li>Store, transmit, or process unlawfully obtained data.</li>
                <li>
                  Infringe the intellectual property rights of any third party.
                </li>
                <li>
                  Attempt to gain unauthorized access to other tenants&apos; data or VireCRM
                  infrastructure.
                </li>
                <li>
                  Reverse engineer, decompile, or disassemble any part of the Service.
                </li>
                <li>
                  Use the Service in any manner that could damage, disable, or impair the Service
                  or interfere with other users.
                </li>
              </ul>
              <p className="mt-2">
                You are solely responsible for ensuring your use of the Service complies with all
                applicable laws and regulations, including marketing and data privacy laws in your
                jurisdiction. VireCRM is not responsible for your compliance obligations.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                5. Subscriptions &amp; Billing
              </h2>
              <p className="mt-2">
                Paid plans are billed on a recurring basis (monthly or annually) via Stripe. Current
                plan pricing is available at{" "}
                <a href="/pricing" className="text-primary hover:underline">
                  virecrm.com/pricing
                </a>
                .
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>
                  Your subscription renews automatically at the end of each billing period unless
                  cancelled.
                </li>
                <li>
                  You may cancel your subscription at any time through the billing portal. Cancellation
                  takes effect at the end of your current billing period — access continues until
                  then and no further charges are made.
                </li>
                <li>
                  We reserve the right to change pricing with at least 30 days&apos; advance
                  notice. Continued use after the price change date constitutes acceptance.
                </li>
                <li>
                  All fees are exclusive of taxes. You are responsible for any applicable taxes in
                  your jurisdiction.
                </li>
              </ul>
              <p className="mt-2">
                For refund eligibility, see our{" "}
                <a href="/refund-policy" className="text-primary hover:underline">
                  Refund Policy
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Data Ownership</h2>
              <p className="mt-2">
                <strong>Your data:</strong> You retain full ownership of all CRM data, contacts,
                leads, and content you input into the Service. VireCRM processes this data on your
                behalf and does not claim any ownership over it.
              </p>
              <p className="mt-2">
                <strong>Our platform:</strong> VireCRM retains all rights, title, and interest in
                the Service, including its codebase, design, algorithms, and proprietary
                technology. Nothing in these Terms grants you any rights to the underlying
                platform beyond the limited right to use the Service as described herein.
              </p>
              <p className="mt-2">
                VireCRM may use aggregated, anonymized, non-identifiable data derived from your
                use of the Service for internal product analytics and improvement purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Termination</h2>
              <p className="mt-2">
                <strong>By you:</strong> You may terminate your account at any time by cancelling
                your subscription and deleting your account through the platform settings.
              </p>
              <p className="mt-2">
                <strong>By us:</strong> We may suspend or terminate your access to the Service
                immediately if you breach these Terms, engage in conduct harmful to other users or
                the platform, or fail to pay amounts owed. We will provide reasonable notice where
                practicable.
              </p>
              <p className="mt-2">
                <strong>After termination:</strong> Your CRM data will be available for export for
                30 days following account closure. After that period, data is deleted in accordance
                with our{" "}
                <a href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Service Availability</h2>
              <p className="mt-2">
                VireCRM is provided on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis.
                We do not guarantee continuous, uninterrupted, or error-free access to the Service.
                Downtime may occur due to scheduled maintenance, system updates, infrastructure
                events, or circumstances beyond our control.
              </p>
              <p className="mt-2">
                We will make commercially reasonable efforts to maintain platform availability and
                to provide advance notice of planned maintenance windows.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                9. Limitation of Liability
              </h2>
              <p className="mt-2">
                To the fullest extent permitted by applicable law, VireCRM (and Darsh Poddar as
                operator) shall not be liable for any indirect, incidental, special, consequential,
                or punitive damages, including but not limited to loss of profits, loss of revenue,
                loss of data, or business interruption, arising out of or related to your use of or
                inability to use the Service, even if we have been advised of the possibility of
                such damages.
              </p>
              <p className="mt-2">
                In all cases, our total aggregate liability to you for any claims arising under or
                related to these Terms shall not exceed the total amount paid by you to VireCRM
                during the thirty (30) days immediately preceding the event giving rise to the
                claim.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Indemnification</h2>
              <p className="mt-2">
                You agree to indemnify, defend, and hold harmless Darsh Poddar and VireCRM from and
                against any claims, damages, liabilities, costs, and expenses (including reasonable
                legal fees) arising from:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Your use of or access to the Service.</li>
                <li>Your violation of these Terms.</li>
                <li>
                  Your violation of any applicable law or the rights of any third party, including
                  data privacy laws applicable to your contacts or customers.
                </li>
                <li>
                  The content or accuracy of data you input into the Service.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">11. Governing Law</h2>
              <p className="mt-2">
                These Terms shall be governed by and construed in accordance with the laws of the
                State of Texas, United States, without regard to its conflict of law principles. Any
                disputes arising under or related to these Terms shall be subject to the exclusive
                jurisdiction of the courts located in Texas.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">12. Modifications</h2>
              <p className="mt-2">
                We reserve the right to update or modify these Terms at any time. When we make
                material changes, we will notify you via email or an in-app notice at least 14 days
                before the changes take effect. Your continued use of the Service after the effective
                date of the revised Terms constitutes your acceptance of those changes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">13. Contact</h2>
              <p className="mt-2">
                Questions or concerns regarding these Terms may be directed to:
              </p>
              <p className="mt-2">
                <strong>Darsh Poddar</strong>
                <br />
                Operator, VireCRM
                <br />
                <a href="mailto:darsh.pod@gmail.com" className="text-primary hover:underline">
                  darsh.pod@gmail.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
