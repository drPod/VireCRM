import type { Dispatch, SetStateAction } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPlanPrice, planBadgeVariant } from "@/lib/admin-utils";
import {
  PLAN_CATALOG,
  planLineItems,
  planTotalCents,
  type PlanCatalogEntry,
} from "@/lib/plan-catalog";
import type { AdminSubmissionRow } from "@/types/admin";

import { SuggestionSignals } from "./SuggestionSignals";

interface SubmissionInvoiceFormProps {
  submission: AdminSubmissionRow;
  suggestion: {
    plan: PlanCatalogEntry;
    reason: string;
    source: "interested_plan" | "budget" | "project_type";
  } | null;
  planValue: string;
  setPlanValue: Dispatch<SetStateAction<string>>;
  selectedPlan: PlanCatalogEntry | null;
  amount: string;
  setAmount: Dispatch<SetStateAction<string>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  dueDays: string;
  setDueDays: Dispatch<SetStateAction<string>>;
  assignPlan: boolean;
  setAssignPlan: Dispatch<SetStateAction<boolean>>;
  setAmountOverridden: Dispatch<SetStateAction<boolean>>;
  creating: boolean;
  onSubmit: () => void;
}

/**
 * The invoice-creation form body, rendered inside `SubmissionInvoicePanel`
 * when the admin presses "Create Invoice". Controlled entirely by the parent
 * — every piece of state + the submit handler are passed in so the parent
 * can keep its existing lifecycle effects (plan-sync, override tracking).
 */
export function SubmissionInvoiceForm({
  submission,
  suggestion,
  planValue,
  setPlanValue,
  selectedPlan,
  amount,
  setAmount,
  description,
  setDescription,
  dueDays,
  setDueDays,
  assignPlan,
  setAssignPlan,
  setAmountOverridden,
  creating,
  onSubmit,
}: SubmissionInvoiceFormProps) {
  return (
    <div className="space-y-2 rounded border border-border bg-background p-3">
      {suggestion ? (
        <div className="space-y-2 rounded bg-primary/10 px-3 py-2 text-xs text-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={planBadgeVariant(suggestion.plan.value)} className="capitalize">
              Suggested: {suggestion.plan.label}
            </Badge>
            <span className="text-muted-foreground">
              ${(planTotalCents(suggestion.plan) / 100).toFixed(0)} · {suggestion.reason}
            </span>
            {planValue !== suggestion.plan.value ? (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-6 px-2 text-xs"
                onClick={() => {
                  setPlanValue(suggestion.plan.value);
                  setAmountOverridden(false);
                }}
              >
                Apply suggestion
              </Button>
            ) : (
              <span className="ml-auto text-[11px] text-muted-foreground">Applied</span>
            )}
          </div>
          <SuggestionSignals submission={submission} source={suggestion.source} />
        </div>
      ) : (
        <div className="space-y-2 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">No plan suggestion</p>
          <SuggestionSignals submission={submission} source={null} />
          <p className="text-[11px]">
            None of <code className="rounded bg-muted px-1">interested_plan</code>,{" "}
            <code className="rounded bg-muted px-1">budget</code>, or{" "}
            <code className="rounded bg-muted px-1">project_type</code> matched a known plan tier.
          </p>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[180px_1fr_120px_100px]">
        <Select
          value={planValue}
          onValueChange={(v) => {
            setPlanValue(v);
            setAmountOverridden(false);
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Use plan…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Custom amount</SelectItem>
            {PLAN_CATALOG.filter((p) => p.invoiceable).map((p) => (
              <SelectItem key={p.value} value={p.value} className="py-2">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {formatPlanPrice(p)}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{p.tagline}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
        />
        <Input
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setAmountOverridden(true);
          }}
          placeholder="Amount USD"
          inputMode="decimal"
          title={selectedPlan ? "Editing this overrides the plan's default amount" : undefined}
        />
        <Input
          value={dueDays}
          onChange={(e) => setDueDays(e.target.value)}
          placeholder="Due days"
          inputMode="numeric"
        />
      </div>

      {selectedPlan ? (
        <div className="rounded bg-muted/40 p-2 text-xs space-y-1">
          <div className="font-medium">
            {selectedPlan.label} — {selectedPlan.tagline}
          </div>
          {planLineItems(selectedPlan).map((li, i) => (
            <div
              key={`${li.description}-${i}`}
              className="flex justify-between text-muted-foreground"
            >
              <span>{li.description}</span>
              <span className="tabular-nums">${(li.amount_cents / 100).toFixed(2)}</span>
            </div>
          ))}
          <label className="flex items-center gap-2 pt-1 text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={assignPlan}
              onChange={(e) => setAssignPlan(e.target.checked)}
              className="accent-primary"
            />
            Also assign this plan to {submission.email} after invoice is sent
          </label>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invoice"}
        </Button>
      </div>
    </div>
  );
}
