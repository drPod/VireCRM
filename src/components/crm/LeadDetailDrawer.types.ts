import type { Lead } from "./LeadCard";

/**
 * Editable shape of the form inside `LeadDetailDrawer`. All values are kept as
 * strings (even numeric ones) so the inputs stay controlled and we can parse +
 * validate at save time.
 */
export interface LeadFormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  score: number;
  next_action: string;
  notes: string;
  annual_kwh: string;
  contract_end_date: string;
  current_supplier: string;
  deal_value: string;
  deal_currency: string;
  assigned_to: string;
}

/** Status options surfaced in the details tab status `<select>`. */
export const STATUS_OPTIONS: Lead["status"][] = [
  "new",
  "contacted",
  "qualified",
  "negotiation",
  "won",
  "lost",
];

export interface OrgMember {
  user_id: string;
  full_name: string;
  role: string;
}

export type LeadDrawerTab = "details" | "activity" | "emails" | "invoices";

/**
 * Billing summary shape rendered in the drawer's compact "collected / due"
 * card. Aggregated client-side from `client_invoices` rows.
 */
export interface LeadBillingSummary {
  count: number;
  collectedCents: number;
  outstandingCents: number;
  recurringActive: number;
  currency: string;
  lastPaidAt: string | null;
  lastInvoiceUrl: string | null;
}
