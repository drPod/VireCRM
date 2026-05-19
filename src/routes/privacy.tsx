import { createFileRoute, Link } from "@tanstack/react-router";
import { useCustomDomainGuard } from "@/hooks/useCustomDomainGuard";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/config/support";

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
          <p className="mt-2 text-sm text-muted-foreground">Last updated: April 16, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Who We Are</h2>
              <p className="mt-2">
                VireCRM ("<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>") is
                operated by Ethan Sereti. This Privacy Policy explains how we collect, use,
                disclose, and safeguard your information when you use our website and services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
              <p className="mt-2">We collect the following categories of personal data:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>
                  <strong>Account Information:</strong> Name, email address, and password when you
                  create an account.
                </li>
                <li>
                  <strong>Organization Data:</strong> Company name, team members, and CRM data you
                  input into the platform.
                </li>
                <li>
                  <strong>Usage Data:</strong> Pages visited, features used, browser type, IP
                  address, and device information.
                </li>
                <li>
                  <strong>Payment Data:</strong> Billing information is processed by our third-party
                  payment processor (see Section 5) and is not stored on our servers.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                3. How We Use Your Information
              </h2>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>To provide, operate, and maintain our services.</li>
                <li>To process transactions and manage your subscription.</li>
                <li>To communicate with you, including support and service updates.</li>
                <li>To improve our services and develop new features.</li>
                <li>To comply with legal obligations.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Data Sharing</h2>
              <p className="mt-2">
                We do not sell your personal data. We may share data with trusted third-party
                service providers who assist us in operating our platform, subject to
                confidentiality obligations. We may also disclose information when required by law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Payments</h2>
              <p className="mt-2">
                Our payment processing is handled by a third-party payment processor. Your payment
                information is processed in accordance with their privacy policy. We do not store
                credit card numbers or sensitive payment details on our servers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
              <p className="mt-2">
                We retain your personal data for as long as your account is active or as needed to
                provide services. You may request deletion of your account and associated data at
                any time by contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Your Rights</h2>
              <p className="mt-2">Depending on your jurisdiction, you may have the right to:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Access, correct, or delete your personal data.</li>
                <li>Object to or restrict processing of your data.</li>
                <li>Data portability — receive your data in a structured format.</li>
                <li>Withdraw consent at any time where processing is based on consent.</li>
              </ul>
              <p className="mt-2">
                To exercise these rights, contact us at{" "}
                <a href={SUPPORT_MAILTO} className="text-primary hover:underline">
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Security</h2>
              <p className="mt-2">
                We implement industry-standard security measures including encryption, access
                controls, and regular security audits to protect your data. However, no method of
                electronic transmission or storage is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Cookies</h2>
              <p className="mt-2">
                We use essential cookies to maintain your session and preferences. We do not use
                third-party advertising cookies. Analytics cookies may be used to understand usage
                patterns and improve the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
              <p className="mt-2">
                We may update this Privacy Policy from time to time. We will notify you of material
                changes by posting the updated policy on this page and updating the "Last updated"
                date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">11. Contact Us</h2>
              <p className="mt-2">
                If you have questions about this Privacy Policy, please contact us at{" "}
                <a href={SUPPORT_MAILTO} className="text-primary hover:underline">
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
