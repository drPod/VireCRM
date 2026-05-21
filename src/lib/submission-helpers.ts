/**
 * Pure helpers for the admin contact-submissions panel. Extracted from the
 * original 1.2k-line `ContactSubmissionsPanel.tsx` so the helpers can be
 * unit-tested + reused across the sibling components that render the same
 * Stripe-invoice + plan-suggestion flow.
 */

import {
  getPlan,
  planTotalCents,
  type PlanCatalogEntry,
} from "@/lib/plan-catalog";
import type { AdminSubmissionRow } from "@/types/admin";

// Detected once at module load — `import.meta.env` is statically baked by
// Vite at build time, so this is effectively a constant.
export const stripeEnv: "sandbox" | "live" = (
  import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined
)?.startsWith("pk_live_")
  ? "live"
  : "sandbox";

// Stripe-invoice status variant. Broader than `subStatusVariant` in
// admin-utils — covers `open`, `void`, `uncollectible`, etc. Kept inline
// because only the submission flow + FinancialsPanel need it; sharing
// the same name in admin-utils would conflict with the subscription-status
// variant.
export function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") return "default";
  if (status === "void" || status === "uncollectible") return "destructive";
  if (status === "open" || status === "sent" || status === "finalized") return "secondary";
  return "outline";
}

// Mailto invoice flow stayed handy for non-Stripe customers.
export function buildInvoiceMailto(s: AdminSubmissionRow): string {
  const subject = `VireCRM — Invoice for your ${s.project_type ?? "project"}`;
  const body = [
    `Hi ${s.name.split(" ")[0] || s.name},`,
    "",
    `Thanks for reaching out about your ${s.project_type ?? "project"}${s.company ? ` at ${s.company}` : ""}.`,
    s.budget
      ? `Based on the ${s.budget} budget you shared, here is your invoice:`
      : "Here is your invoice:",
    "",
    "Amount: $______",
    "Payment link: ______",
    "",
    "Reply to this email with any questions.",
    "",
    "— Ethan, VireCRM",
  ].join("\n");
  return `mailto:${s.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Heuristic: pick the most appropriate plan from PLAN_CATALOG for a given
 * submission, based on (in priority order):
 *   1. an explicit `interested_plan` / `plan` hint stored in metadata (from
 *      pricing-page CTAs that pre-select a tier)
 *   2. the prospect's selected budget range
 *   3. a soft signal from project_type (enterprise-style projects → pro)
 * Returns the plan catalog entry the admin should default to, plus a short
 * human-readable reason. Returns null when no signal is strong enough — the
 * panel falls back to the legacy "custom" amount in that case.
 */
export function suggestPlanForSubmission(s: AdminSubmissionRow): {
  plan: PlanCatalogEntry;
  reason: string;
  source: "interested_plan" | "budget" | "project_type";
} | null {
  const metaPlan =
    typeof s.metadata?.["interested_plan"] === "string"
      ? (s.metadata["interested_plan"] as string)
      : typeof s.metadata?.["plan"] === "string"
        ? (s.metadata["plan"] as string)
        : null;
  if (metaPlan) {
    const normalized = metaPlan.toLowerCase().replace(/[\s-]+/g, "_");
    const isFullOwnership =
      normalized.includes("full_ownership") ||
      normalized === "ownership_full" ||
      normalized === "full";
    const key = isFullOwnership ? "full_ownership" : normalized;
    const p = getPlan(key);
    if (p && p.invoiceable)
      return {
        plan: p,
        reason: "Prospect picked this plan on the site",
        source: "interested_plan",
      };
  }

  const b = (s.budget ?? "").toLowerCase();
  const matchByBudget = (): PlanCatalogEntry | null => {
    if (!b) return null;
    if (b.includes("enterprise") || b.includes("100k") || b.includes("50k")) {
      return getPlan("enterprise");
    }
    if (b.includes("7k") || b.includes("7,000") || b.includes("full ownership")) {
      return getPlan("full_ownership");
    }
    if (b.includes("14") || b.includes("10k") || b.includes("10,000") || b.includes("20k")) {
      return getPlan("pro");
    }
    if (
      b.includes("5k") ||
      b.includes("5,000") ||
      b.includes("3k") ||
      b.includes("2.5k") ||
      b.includes("2500")
    ) {
      return getPlan("growth");
    }
    if (b.includes("1k") || b.includes("1,000") || b.includes("500")) {
      return getPlan("starter");
    }
    return null;
  };

  const fromBudget = matchByBudget();
  if (fromBudget && fromBudget.invoiceable) {
    return { plan: fromBudget, reason: `Matched budget "${s.budget}"`, source: "budget" };
  }

  const pt = (s.project_type ?? "").toLowerCase();
  if (
    pt.includes("full ownership") ||
    pt.includes("full_ownership") ||
    pt.includes("source code") ||
    pt.includes("buyout")
  ) {
    const p = getPlan("full_ownership");
    if (p)
      return {
        plan: p,
        reason: `Project type "${s.project_type}" suggests Full Ownership`,
        source: "project_type",
      };
  }
  if (pt.includes("enterprise") || pt.includes("white") || pt.includes("custom")) {
    const p = getPlan("enterprise");
    if (p)
      return {
        plan: p,
        reason: `Project type "${s.project_type}" suggests enterprise`,
        source: "project_type",
      };
  }
  if (pt.includes("crm") || pt.includes("sales")) {
    const p = getPlan("growth");
    if (p)
      return {
        plan: p,
        reason: `Project type "${s.project_type}" suggests growth`,
        source: "project_type",
      };
  }

  return null;
}

// Best-effort default amount based on the budget label the prospect picked.
// Used as a fallback when no plan can be matched.
export function suggestAmount(s: AdminSubmissionRow): string {
  const suggested = suggestPlanForSubmission(s);
  if (suggested) return (planTotalCents(suggested.plan) / 100).toFixed(2);
  const b = (s.budget ?? "").toLowerCase();
  if (b.includes("14")) return "14000";
  if (b.includes("10k") || b.includes("10,000")) return "10000";
  if (b.includes("5k") || b.includes("5,000")) return "5000";
  if (b.includes("2.5k") || b.includes("2500")) return "2500";
  if (b.includes("1k") || b.includes("1,000")) return "1000";
  return "";
}
