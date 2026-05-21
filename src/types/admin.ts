/**
 * Shared admin-console types used across the per-panel components in
 * `src/components/admin/`. Extracted from the original 2.7k-line
 * `src/routes/_app.admin.tsx` so each panel file can stay narrow.
 */

export interface AdminOrgRow {
  id: string;
  name: string;
  slug: string;
  industry_template: string | null;
  plan: string | null;
  member_count: number;
  lead_count: number;
  created_at: string;
  owner_email: string | null;
  subscription_status: string | null;
  subscription_price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

export interface OrgBillingSubscription {
  id: string;
  status: string;
  price_id: string | null;
  product_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  created_at: string;
}

export interface OrgBillingInvoice {
  id: string;
  number: string | null;
  status: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  currency: string;
  hosted_invoice_url: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface OrgBillingSnapshot {
  owner: { user_id: string; email: string } | null;
  subscriptions: OrgBillingSubscription[];
  invoices: OrgBillingInvoice[];
}

export interface AdminProfileRow {
  user_id: string;
  full_name: string | null;
  organization_id: string;
  organization_name: string;
  created_at: string;
}

export interface AdminSubmissionRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  project_type: string | null;
  budget: string | null;
  message: string;
  status: string;
  origin: string | null;
  test_mode: boolean;
  sentiment: string | null;
  topic: string | null;
  intent_summary: string | null;
  priority_suggestion: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  replied_at: string | null;
}

export interface PlatformInvoiceRow {
  id: string;
  stripe_invoice_id: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  number: string | null;
  amount_due_cents: number;
  amount_paid_cents: number;
  currency: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  voided_at: string | null;
  sent_at: string | null;
  environment: string;
  created_at: string;
}

export interface PaymentHistoryResult {
  email: string | null;
  stripe_customer_ids: string[] | null;
  invoices: Array<{
    id: string;
    submission_id: string | null;
    customer_email: string;
    stripe_customer_id: string | null;
    stripe_invoice_id: string | null;
    hosted_invoice_url: string | null;
    invoice_pdf: string | null;
    number: string | null;
    description: string | null;
    amount_due_cents: number;
    amount_paid_cents: number;
    currency: string;
    status: string;
    created_at: string;
    paid_at: string | null;
    environment: string;
  }>;
  totals: {
    invoices?: number;
    paid_count?: number;
    paid_cents?: number;
    outstanding_cents?: number;
  };
}

export interface FinancialOverview {
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
    new_this_month: number;
    ending_soon: number;
  };
  invoices: {
    total: number;
    paid_count: number;
    outstanding_count: number;
    void_count: number;
    new_this_month: number;
    paid_cents_total: number;
    paid_cents_this_month: number;
    outstanding_cents: number;
  };
  organizations: {
    total: number;
    new_this_month: number;
    resellers: number;
    paying: number;
  };
  users: { total: number; new_this_month: number };
  recent_invoices: Array<{
    id: string;
    customer_email: string;
    customer_name: string | null;
    amount_due_cents: number;
    amount_paid_cents: number;
    currency: string;
    status: string;
    number: string | null;
    hosted_invoice_url: string | null;
    created_at: string;
    paid_at: string | null;
  }>;
  recent_subscriptions: Array<{
    id: string;
    user_id: string;
    email: string | null;
    product_id: string;
    price_id: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    created_at: string;
    environment: string;
  }>;
  plan_breakdown: Record<string, number>;
  generated_at: string;
}

export interface TemplateAuditRow {
  id: string;
  organization_id: string | null;
  organization_name: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_is_platform_admin: boolean;
  old_template: string | null;
  new_template: string | null;
  action: "changed" | "denied";
  reason: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
