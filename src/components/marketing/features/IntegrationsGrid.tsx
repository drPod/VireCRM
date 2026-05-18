import { Calendar, CreditCard, Database, FileText, Globe2, Mail, MessageCircle, Phone, Slack, Workflow, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const INTEGRATIONS: { name: string; icon: LucideIcon; tagline: string }[] = [
  { name: "Stripe", icon: CreditCard, tagline: "Invoices, subscriptions, Connect payouts" },
  { name: "Resend", icon: Mail, tagline: "Transactional + outbound email" },
  { name: "Google Calendar", icon: Calendar, tagline: "Two-way sync, round-robin" },
  { name: "WhatsApp", icon: MessageCircle, tagline: "Cloud API, templates, replies" },
  { name: "Twilio SMS", icon: Phone, tagline: "Outbound + conversational" },
  { name: "Apollo", icon: Database, tagline: "Enriched lead import" },
  { name: "n8n", icon: Workflow, tagline: "Self-host event hooks" },
  { name: "Zapier", icon: Zap, tagline: "5,000+ pre-built connectors" },
  { name: "Slack", icon: Slack, tagline: "Hot-lead pings, deal alerts" },
  { name: "Cloudflare", icon: Globe2, tagline: "Custom domains, edge routing" },
  { name: "DocuSign", icon: FileText, tagline: "E-sign on quote acceptance" },
  { name: "Custom webhooks", icon: Workflow, tagline: "Build your own — every event fires" },
];

export function IntegrationsGrid() {
  return (
    <section
      id="integrations"
      className="relative scroll-mt-32 border-t border-border/60 bg-card/30 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Plays nice with your stack
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Connects to the tools your team already uses.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Native integrations for the most-asked-for services. Everything else hooks in via webhooks,
            n8n, or Zapier.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {INTEGRATIONS.map((i) => (
            <li
              key={i.name}
              className="flex items-start gap-3 rounded-xl border border-border bg-background/60 p-4 transition-colors hover:border-primary/30 hover:bg-background"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <i.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{i.name}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{i.tagline}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
