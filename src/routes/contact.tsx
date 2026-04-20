import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ContactForm } from "@/components/marketing/ContactForm";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact Us — Genesis Custom CRM" },
      { name: "description", content: "Get a custom-built CRM tailored to your business. Contact us for enterprise pricing starting at $14,000." },
      { property: "og:title", content: "Contact Us — Genesis Custom CRM" },
      { property: "og:description", content: "Get a custom-built CRM tailored to your business. Enterprise pricing from $14K." },
    ],
  }),
});

function ContactPage() {
  return (
    <div className="min-h-screen">
      <MarketingHeader />

      <section className="pt-32 pb-20">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold text-foreground">
              Let's Build Your Custom CRM
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Tell us about your business and we'll craft a tailored Genesis CRM solution — starting at $14,000.
            </p>
          </div>

          <ContactForm />
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
