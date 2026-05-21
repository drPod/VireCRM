import { Loader2, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DealValidation } from "./LeadDetailsForm";
import type { LeadFormState } from "./LeadDetailDrawer.types";

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

/**
 * Deal-value sub-panel of the details form. Shows the amount + currency
 * inputs plus the inline "Mark as Won" button (or a Won badge once status
 * is already "won").
 */
export function LeadDealValuePanel({
  form,
  update,
  dealValidation,
  markingWon,
  onMarkWon,
}: {
  form: LeadFormState;
  update: (field: keyof LeadFormState, value: string | number) => void;
  dealValidation: DealValidation;
  markingWon: boolean;
  onMarkWon: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-3 ${
        form.status === "won"
          ? "border-success/40 bg-success/5"
          : "border-border bg-secondary/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Deal value
        </p>
        {form.status !== "won" ? (
          <Button
            variant="command"
            size="sm"
            onClick={onMarkWon}
            disabled={markingWon || !dealValidation.valid}
            className="h-7 px-2.5 text-xs"
            title={
              dealValidation.valid
                ? "Mark this lead as won and record the deal value"
                : "Enter a positive deal value first"
            }
          >
            {markingWon ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trophy className="mr-1.5 h-3.5 w-3.5" />
            )}
            Mark as Won
          </Button>
        ) : (
          <Badge variant="success" className="text-[10px]">
            <Trophy className="mr-1 h-3 w-3" /> Won
          </Badge>
        )}
      </div>
      <div className="grid gap-3 grid-cols-[1fr_90px]">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            Amount <span className="text-destructive">*</span>
          </label>
          <input
            inputMode="decimal"
            className={`${inputClass} ${!dealValidation.valid ? "border-destructive focus:ring-destructive" : ""}`}
            value={form.deal_value}
            onChange={(e) => update("deal_value", e.target.value)}
            placeholder="e.g. 2500"
            aria-invalid={!dealValidation.valid}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Currency</label>
          <select
            className={inputClass}
            value={form.deal_currency}
            onChange={(e) => update("deal_currency", e.target.value)}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
          </select>
        </div>
      </div>
      {!dealValidation.valid && (
        <p className="text-[11px] text-destructive leading-relaxed">{dealValidation.error}</p>
      )}
    </div>
  );
}
