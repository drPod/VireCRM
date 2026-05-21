import { Calculator, ChevronRight } from "lucide-react";
import type { LeadBillingSummary } from "./LeadDetailDrawer.types";

/**
 * Compact "collected / due" card surfaced on every tab of `LeadDetailDrawer`
 * once at least one invoice exists. Click jumps to the Invoices tab.
 */
export function LeadBillingSummaryCard({
  summary,
  onOpenInvoices,
}: {
  summary: LeadBillingSummary;
  onOpenInvoices: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenInvoices}
      className="mt-3 w-full rounded-lg border border-border bg-card/60 px-3 py-2 text-left transition-colors hover:bg-muted/40"
      title="View invoices for this lead"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-success font-semibold tabular-nums">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: summary.currency,
                }).format(summary.collectedCents / 100)}
              </span>
              <span className="text-muted-foreground">collected</span>
              {summary.outstandingCents > 0 && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-warning font-semibold tabular-nums">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: summary.currency,
                    }).format(summary.outstandingCents / 100)}
                  </span>
                  <span className="text-muted-foreground">due</span>
                </>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              {summary.count} {summary.count === 1 ? "invoice" : "invoices"}
              {summary.recurringActive > 0 && ` · ${summary.recurringActive} recurring`}
              {summary.lastPaidAt &&
                ` · last paid ${new Date(summary.lastPaidAt).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </button>
  );
}
