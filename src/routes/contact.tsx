import { createFileRoute } from "@tanstack/react-router";
import { useCustomDomainGuard } from "@/hooks/useCustomDomainGuard";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ContactForm } from "@/components/marketing/ContactForm";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/config/support";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact Us — Genesis Custom CRM" },
      {
        name: "description",
        content:
          "Get a custom-built CRM tailored to your business. Contact us for enterprise pricing starting at $14,000.",
      },
      { property: "og:title", content: "Contact Us — Genesis Custom CRM" },
      {
        property: "og:description",
        content: "Get a custom-built CRM tailored to your business. Enterprise pricing from $14K.",
      },
      { property: "og:url", content: "https://genesisx.space/contact" },
    ],
    links: [{ rel: "canonical", href: "https://genesisx.space/contact" }],
  }),
});

function ContactPage() {
  if (useCustomDomainGuard()) return null;
  return (
    <div className="min-h-screen">
      <MarketingHeader />

      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold text-foreground">Let's Build Your Custom CRM</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Tell us about your business and we'll craft a tailored Genesis CRM solution — starting
              at $14,000.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Prefer to talk?{" "}
              <a
                href="tel:+19403656600"
                className="font-semibold text-foreground hover:text-primary"
              >
                +1 (940) 365-6600
              </a>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Or email us at{" "}
              <a href={SUPPORT_MAILTO} className="font-semibold text-foreground hover:text-primary">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>

          <ContactForm />
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
