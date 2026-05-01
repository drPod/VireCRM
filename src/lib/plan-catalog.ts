/**
 * Single source of truth for the plans the platform admin can assign and
 * invoice for. Used by:
 *   - Admin org row "Assign plan" dropdown (label only, key = `value`)
 *   - SubmissionInvoicePanel "Use plan" dropdown — auto-fills the line
 *     items + amount from this catalog so the invoice always reflects the
 *     plan the admin actually plans to assign.
 *
 * Pricing is in USD cents. `setupCents` is an optional one-time setup fee
 * that gets added as a second line item. `interval` is informational —
 * platform_invoices always render the full amount up-front (this is a
 * Stripe Invoice, not a recurring subscription); we just label the line
 * item so the prospect understands what they're paying for.
 */
export type PlanInterval = "one_time" | "month" | "year";

export interface PlanLineItem {
  description: string;
  amount_cents: number;
  quantity?: number;
}

export interface PlanCatalogEntry {
  /** Stable key — also matches the values accepted by admin_set_org_plan. */
  value: string;
  label: string;
  /** Short tagline shown under the label in dropdowns. */
  tagline: string;
  /** Recurring price in cents (0 = free). */
  recurringCents: number;
  /** Interval the recurring price applies to. */
  interval: PlanInterval;
  /** Optional one-time setup fee added as a separate line item. */
  setupCents?: number;
  /** Whether this plan can be picked from the invoice flow. */
  invoiceable: boolean;
}

export const PLAN_CATALOG: ReadonlyArray<PlanCatalogEntry> = [
  {
    value: "free",
    label: "Free",
    tagline: "Trial / unassigned",
    recurringCents: 0,
    interval: "month",
    invoiceable: false,
  },
  {
    value: "starter",
    label: "Starter",
    tagline: "Solo operator — 1 seat",
    recurringCents: 4900,
    interval: "month",
    invoiceable: true,
  },
  {
    value: "growth",
    label: "Growth",
    tagline: "Small team — up to 5 seats",
    recurringCents: 14900,
    interval: "month",
    invoiceable: true,
  },
  {
    value: "pro",
    label: "Pro",
    tagline: "Full CRM — up to 15 seats",
    recurringCents: 39900,
    interval: "month",
    invoiceable: true,
  },
  {
    value: "enterprise",
    label: "Enterprise",
    tagline: "Custom build + onboarding",
    recurringCents: 99900,
    interval: "month",
    setupCents: 250000,
    invoiceable: true,
  },
  {
    value: "ownership",
    label: "Ownership (host)",
    tagline: "White-label — host-assigned only",
    recurringCents: 0,
    interval: "month",
    invoiceable: false,
  },
];

export function getPlan(value: string | null | undefined): PlanCatalogEntry | null {
  if (!value) return null;
  return PLAN_CATALOG.find((p) => p.value === value) ?? null;
}

/** Build the line items that should be billed for a single-cycle invoice
 *  of this plan. Returns at least one line item for any invoiceable plan. */
export function planLineItems(plan: PlanCatalogEntry): PlanLineItem[] {
  const items: PlanLineItem[] = [];
  if (plan.recurringCents > 0) {
    items.push({
      description: `${plan.label} plan — first ${plan.interval === "year" ? "year" : "month"}`,
      amount_cents: plan.recurringCents,
      quantity: 1,
    });
  }
  if (plan.setupCents && plan.setupCents > 0) {
    items.push({
      description: `${plan.label} — onboarding & setup (one-time)`,
      amount_cents: plan.setupCents,
      quantity: 1,
    });
  }
  return items;
}

export function planTotalCents(plan: PlanCatalogEntry): number {
  return planLineItems(plan).reduce((sum, li) => sum + li.amount_cents * (li.quantity || 1), 0);
}
