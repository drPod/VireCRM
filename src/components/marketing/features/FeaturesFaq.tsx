import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How long does setup take?",
    a: "Most teams are live in 3–5 business days. We import your existing leads, configure your pipeline stages, wire up your domain, and walk you through onboarding with a real human — not a chatbot. Enterprise white-label deployments take 7–14 days for full custom theming and per-tenant Stripe Connect setup.",
  },
  {
    q: "Do you charge per seat?",
    a: "No. Every VireCRM plan includes unlimited seats inside your org. We charge per workspace, per month — so adding users doesn't push you onto the next tier. Resellers get separate pricing per child org with their own seat counts and billing relationships.",
  },
  {
    q: "Who owns the data?",
    a: "You do. VireCRM is built on Supabase Postgres with row-level security per tenant. You can export everything as CSV or via the API at any time. We never sell or share customer data with third parties. SOC 2 Type II is in progress.",
  },
  {
    q: "Can I really white-label and resell this?",
    a: "Yes — and that's a first-class feature, not a workaround. Each of your customers gets their own custom domain (we provision SSL via Cloudflare for SaaS), their own theme, logo, and color palette, their own user pool, and their own billing relationship with you. You decide pricing; VireCRM charges you wholesale per active workspace.",
  },
  {
    q: "Is the AI advisor really useful or just hype?",
    a: "Real. The advisor uses Anthropic Claude with grounded retrieval over your pipeline, contacts, and conversation history. It can draft sequences, suggest next actions, surface hot leads, and explain its scoring. There's an audit log of every AI action — your team sees exactly what it did, when, and why.",
  },
  {
    q: "What if I'm already on HubSpot, Pipedrive, or Salesforce?",
    a: "We have a guided migration that handles contacts, deals, custom fields, notes, and historical activities for the three biggest CRMs. Most migrations land cleanly in under an hour. We don't charge for migration help — it's part of every plan.",
  },
  {
    q: "How does billing work for resellers and their customers?",
    a: "You get one VireCRM invoice per month covering all active customer workspaces. Each customer pays you on a billing schedule and price you control — via Stripe Connect inside your reseller dashboard. We never touch your customer's payment relationship.",
  },
  {
    q: "What's your refund policy?",
    a: "We don't offer cash refunds, but every paid plan has a 14-day no-questions money-back guarantee during onboarding. After that, you can cancel any time and we'll keep your data accessible for 90 days for export.",
  },
];

export function FeaturesFaq() {
  return (
    <section
      id="faq"
      className="relative scroll-mt-32 border-t border-border/60 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            FAQ
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Questions teams ask before they switch.
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-12 divide-y divide-border/60">
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`} className="border-b-0">
              <AccordionTrigger className="py-5 text-left text-base font-semibold text-foreground hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
