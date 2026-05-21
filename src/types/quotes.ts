/**
 * Shared types + constants for admin quotes.
 * Extracted from src/components/admin/QuotesPanel.tsx during the 2026-05-21 split.
 */

export type QuoteStatus = "draft" | "sent" | "paid" | "cancelled";

export interface LineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

export interface Differentiator {
  title: string;
  body: string;
}

export interface Quote {
  id: string;
  quote_number: string;
  recipient_name: string;
  recipient_email: string;
  recipient_company: string | null;
  title: string;
  notes: string | null;
  line_items: LineItem[];
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  status: QuoteStatus;
  payment_link_url: string | null;
  sent_at: string | null;
  paid_at: string | null;
  valid_until: string | null;
  created_at: string;
  differentiators: Differentiator[] | null;
  pdf_url: string | null;
}

export const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  paid: "bg-green-500/15 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
};

export const emptyLineItem = (): LineItem => ({
  description: "",
  quantity: 1,
  unit_price_cents: 0,
});

export const DEFAULT_DIFFERENTIATORS: Differentiator[] = [
  {
    title: "Built-in AI sales team",
    body: "Lead scoring, reply classification, follow-up writing, and meeting booking are first-class agents — not bolt-ons.",
  },
  {
    title: "One platform replaces 6+ tools",
    body: "CRM, outreach, scheduling, pipeline, billing, and reporting in one place. No Zapier glue.",
  },
  {
    title: "True white-label",
    body: "Your domain, your branding, your login, your customers. VireCRM is invisible.",
  },
  {
    title: "Capped, transparent pricing",
    body: "Flat monthly tiers — no per-seat creep, no usage surprises.",
  },
  {
    title: "Industry-tuned templates",
    body: "Pre-built pipelines, automations, and email templates for solar, insurance, real estate, gym, and more.",
  },
  {
    title: "Real human + AI support",
    body: "Founders in the loop. Slack-grade response time, not a help-desk maze.",
  },
];
