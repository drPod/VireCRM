import { createFileRoute } from "@tanstack/react-router";
import { useCustomDomainGuard } from "@/hooks/useCustomDomainGuard";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — VireCRM" },
      {
        name: "description",
        content:
          "How VireCRM collects, uses, and protects your personal data when you use our AI CRM platform.",
      },
      { property: "og:title", content: "Privacy Policy — VireCRM" },
      {
        property: "og:description",
        content: "How VireCRM collects, uses, and protects your personal data.",
      },
      { property: "og:url", content: "https://virecrm.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://virecrm.com/privacy" }],
  }),
});

function PrivacyPage() {
  if (useCustomDomainGuard()) return null;
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 pt-12 pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: May 20, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Who We Are</h2>
              <p className="mt-2">
                VireCRM (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is operated by
                Darsh Poddar, an individual operating the service at{" "}
                <a href="https://virecrm.com" className="text-primary hover:underline">
                  virecrm.com
                </a>
                . This Privacy Policy explains how we collect, use, disclose, and safeguard your
                information when you use VireCRM and its related services (collectively, the
                &ldquo;Service&rdquo;).
              </p>
              <p className="mt-2">
                By using the Service, you agree to the collection and use of information in
                accordance with this policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
              <p className="mt-2">We collect the following categories of personal data:</p>
              <ul className="mt-2 list-disc pl-6 space-y-2">
                <li>
                  <strong>Account Information:</strong> Your name and email address when you create
                  an account or sign in via Google OAuth.
                </li>
                <li>
                  <strong>Organization &amp; CRM Data:</strong> Company name, team member profiles,
                  leads, contacts, deals, notes, and any other data you or your team enter into the
                  platform. You own this data — we process it on your behalf.
                </li>
                <li>
                  <strong>Usage Data:</strong> Pages visited, features used, session duration,
                  browser type, operating system, IP address, and device identifiers. Collected
                  automatically to operate and improve the Service.
                </li>
                <li>
                  <strong>Payment Data:</strong> Billing and payment information is collected and
                  processed directly by Stripe. We do not store credit card numbers or sensitive
                  payment details on our servers.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Google Sign-In Data</h2>
              <p className="mt-2">
                When you choose to sign in with Google, we request access to your Google account
                email address and display name. This data is used exclusively to:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Create or authenticate your VireCRM account.</li>
                <li>Pre-fill your profile name within the platform.</li>
              </ul>
              <p className="mt-2">
                We do not use your Google account data for marketing purposes, and we do not share
                it with third parties beyond what is necessary to operate the Service. We do not
                request access to your Google contacts, calendar, Drive, or any other Google
                services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                4. How We Use Your Information
              </h2>
              <p className="mt-2">We use the data we collect to:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Provide, operate, and maintain the Service.</li>
                <li>Process your subscription and manage billing via Stripe.</li>
                <li>
                  Send transactional emails (account confirmations, password resets, billing
                  receipts) via Resend.
                </li>
                <li>Respond to your support requests and inquiries.</li>
                <li>Analyze usage patterns and improve platform features.</li>
                <li>Detect, prevent, and address technical issues or security incidents.</li>
                <li>Comply with applicable legal obligations.</li>
              </ul>
              <p className="mt-2">
                We do not use your data for advertising or sell it to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Third-Party Processors</h2>
              <p className="mt-2">
                We engage the following sub-processors to deliver the Service. Each operates under
                its own privacy policy and data processing agreements:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-2">
                <li>
                  <strong>Supabase</strong> — Database hosting and user authentication.
                  Authentication tokens and all CRM data are stored in Supabase-managed
                  infrastructure.
                </li>
                <li>
                  <strong>Stripe</strong> — Payment processing and subscription management. Payment
                  card data is handled exclusively by Stripe and governed by their PCI DSS compliance
                  program.
                </li>
                <li>
                  <strong>Resend</strong> — Transactional email delivery (account emails, billing
                  notifications, team invitations).
                </li>
                <li>
                  <strong>Cloudflare</strong> — Hosting, content delivery network (CDN), and edge
                  routing. Your requests to VireCRM are processed through Cloudflare&apos;s
                  infrastructure.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Data Sharing</h2>
              <p className="mt-2">
                We do not sell, rent, or trade your personal data. We may share data only in the
                following circumstances:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>
                  <strong>Service Providers:</strong> With the sub-processors listed in Section 5,
                  solely to provide the Service, under confidentiality obligations.
                </li>
                <li>
                  <strong>Legal Requirements:</strong> If required to do so by law, court order, or
                  governmental authority.
                </li>
                <li>
                  <strong>Business Transfer:</strong> In the event of a merger, acquisition, or sale
                  of substantially all assets, your data may be transferred as part of that
                  transaction. You will be notified via email and/or a prominent notice on the
                  Service.
                </li>
                <li>
                  <strong>Protection of Rights:</strong> To enforce our Terms of Service, protect the
                  security or integrity of the Service, or protect the rights and safety of our users
                  or the public.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Data Retention</h2>
              <p className="mt-2">
                We retain your personal data for as long as your account remains active or as needed
                to provide the Service. Upon account deletion:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>
                  Your CRM data and profile information are scheduled for deletion within 90 days.
                </li>
                <li>
                  Billing records may be retained for up to 7 years as required by applicable tax
                  and financial regulations.
                </li>
                <li>
                  Aggregated, anonymized usage data that cannot identify you individually may be
                  retained indefinitely for product analytics.
                </li>
              </ul>
              <p className="mt-2">
                To request early deletion of your data, contact us at{" "}
                <a href="mailto:darsh.pod@gmail.com" className="text-primary hover:underline">
                  darsh.pod@gmail.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Security</h2>
              <p className="mt-2">
                We implement industry-standard security measures to protect your data, including:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Encryption of data at rest and in transit (TLS/HTTPS).</li>
                <li>Row-level security enforced at the database layer.</li>
                <li>Role-based access controls limiting data access to authorized personnel.</li>
                <li>Authentication via Supabase Auth with support for multi-factor authentication.</li>
              </ul>
              <p className="mt-2">
                No method of electronic transmission or storage is 100% secure. While we strive to
                protect your data, we cannot guarantee absolute security. Please notify us
                immediately if you suspect unauthorized access to your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Your Rights</h2>
              <p className="mt-2">
                Depending on your jurisdiction, you may have the following rights regarding your
                personal data:
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>
                  <strong>Access:</strong> Request a copy of the personal data we hold about you.
                </li>
                <li>
                  <strong>Correction:</strong> Request correction of inaccurate or incomplete data.
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your personal data, subject to
                  legal retention requirements.
                </li>
                <li>
                  <strong>Portability:</strong> Receive your data in a structured, machine-readable
                  format.
                </li>
                <li>
                  <strong>Restriction:</strong> Request that we limit processing of your data in
                  certain circumstances.
                </li>
                <li>
                  <strong>Objection:</strong> Object to processing where we rely on legitimate
                  interests as our legal basis.
                </li>
                <li>
                  <strong>Withdraw Consent:</strong> Where processing is based on your consent,
                  withdraw it at any time without affecting the lawfulness of prior processing.
                </li>
              </ul>
              <p className="mt-2">
                California residents may also exercise rights under the California Consumer Privacy
                Act (CCPA), including the right to know, delete, and opt out of the sale of personal
                information (we do not sell personal information).
              </p>
              <p className="mt-2">
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:darsh.pod@gmail.com" className="text-primary hover:underline">
                  darsh.pod@gmail.com
                </a>
                . We will respond within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Cookies</h2>
              <p className="mt-2">
                We use essential cookies and local storage tokens to maintain your authenticated
                session and remember your preferences. We do not use third-party advertising or
                tracking cookies. If analytics cookies are employed in the future, this policy will
                be updated and you will be notified.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">11. Changes to This Policy</h2>
              <p className="mt-2">
                We may update this Privacy Policy from time to time. When we make material changes,
                we will notify you via email or a prominent in-app notice prior to the change taking
                effect, and update the &ldquo;Last updated&rdquo; date at the top of this page.
                Your continued use of the Service after the effective date constitutes acceptance of
                the revised policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">12. Contact</h2>
              <p className="mt-2">
                For questions, data requests, or concerns about this Privacy Policy, contact:
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
