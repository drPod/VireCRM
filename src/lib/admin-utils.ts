import { planTotalCents, type PlanCatalogEntry } from "@/lib/plan-catalog";

/**
 * Admin-console helpers extracted from `src/routes/_app.admin.tsx`.
 * Pure functions — formatting + status-variant lookup shared across
 * the per-panel components in `src/components/admin/`.
 */

// Plan dropdown options derive from the shared catalog so the org-row
// "Assign plan" select and the invoice "Use plan" select can never drift.
// We render label + price + tagline so it's impossible to pick the wrong tier
// at a glance (e.g. confusing "ownership" vs "full_ownership" — one is free
// host-assigned, the other is a $7,000 source-code purchase).
export function formatPlanPrice(p: PlanCatalogEntry): string {
  if (p.recurringCents === 0 && !p.setupCents) return "Free";
  const total = planTotalCents(p);
  const dollars = (total / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p.interval === "one_time") return `$${dollars} one-time`;
  return `$${dollars}/${p.interval === "year" ? "yr" : "mo"}`;
}

export function planBadgeVariant(
  plan: string | null,
): "default" | "secondary" | "outline" | "destructive" {
  if (!plan || plan === "free") return "outline";
  if (plan === "ownership") return "default";
  if (plan === "enterprise" || plan === "pro") return "secondary";
  return "outline";
}

export function subStatusVariant(
  status: string | null | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  if (status === "active" || status === "trialing") return "default";
  if (status === "past_due" || status === "unpaid") return "destructive";
  if (status === "canceled" || status === "incomplete_expired") return "outline";
  return "secondary";
}
