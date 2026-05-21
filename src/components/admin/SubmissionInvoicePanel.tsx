import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/hooks/useConfirm";
import { formatPlanPrice } from "@/lib/admin-utils";
import {
  PLAN_CATALOG,
  getPlan,
  planLineItems,
  planTotalCents,
  type PlanCatalogEntry,
} from "@/lib/plan-catalog";
import {
  stripeEnv,
  suggestAmount,
  suggestPlanForSubmission,
} from "@/lib/submission-helpers";
import type { AdminSubmissionRow, PlatformInvoiceRow } from "@/types/admin";

import { SubmissionInvoiceForm } from "./SubmissionInvoiceForm";
import { SubmissionInvoiceListItem } from "./SubmissionInvoiceListItem";

/* --------------------- Stripe Invoice for a Submission ------------------- */

export function SubmissionInvoicePanel({ submission }: { submission: AdminSubmissionRow }) {
  const [invoices, setInvoices] = useState<PlatformInvoiceRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const { confirm, prompt } = useConfirm();

  const runInvoiceAction = async (
    inv: PlatformInvoiceRow,
    action: "void" | "refund" | "resend",
  ) => {
    let amountCents: number | undefined;
    if (action === "void") {
      const ok = await confirm({
        title: `Void invoice ${inv.number ?? inv.stripe_invoice_id}?`,
        description: "The customer will no longer be able to pay it.",
        confirmLabel: "Void invoice",
        destructive: true,
      });
      if (!ok) return;
    } else if (action === "resend") {
      const ok = await confirm({
        title: `Resend invoice ${inv.number ?? inv.stripe_invoice_id}?`,
        description: "Stripe will email this invoice to the prospect again.",
        confirmLabel: "Resend email",
      });
      if (!ok) return;
    } else {
      const fullDollars = (inv.amount_paid_cents / 100).toFixed(2);
      const input = await prompt({
        title: "Refund invoice",
        description: `Refund amount in ${inv.currency.toUpperCase()} (max $${fullDollars}). Leave blank for full refund.`,
        inputLabel: "Amount",
        defaultValue: fullDollars,
        placeholder: fullDollars,
        inputMode: "decimal",
        confirmLabel: "Issue refund",
        destructive: true,
      });
      if (input === null) return;
      const trimmed = input.trim();
      if (trimmed.length > 0) {
        const parsed = Number.parseFloat(trimmed);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          toast.error("Invalid refund amount");
          return;
        }
        amountCents = Math.round(parsed * 100);
      }
    }

    setActingId(inv.id);
    const { data, error } = await supabase.functions.invoke("admin-invoice-action", {
      body: { invoiceId: inv.id, action, amountCents },
    });
    setActingId(null);

    if (error || (data as { error?: string } | null)?.error) {
      const msg = (data as { error?: string } | null)?.error || error?.message || "Action failed";
      toast.error(msg);
      return;
    }
    toast.success(
      action === "void"
        ? "Invoice voided"
        : action === "resend"
          ? "Invoice email resent"
          : "Refund issued",
    );
    void load();
  };

  // Plan-driven invoice. When a plan is picked, description/amount/line items
  // come from the catalog so the invoice cannot drift from what we'll assign.
  // "custom" lets the admin enter a one-off price (legacy behavior).
  // Initial value is auto-suggested from the submission's budget / metadata
  // so the panel opens pre-filled with the most likely tier.
  const suggestion = useMemo(() => suggestPlanForSubmission(submission), [submission]);
  const [planValue, setPlanValue] = useState<string>(suggestion?.plan.value ?? "custom");
  const selectedPlan: PlanCatalogEntry | null = useMemo(
    () => (planValue === "custom" ? null : getPlan(planValue)),
    [planValue],
  );

  const [amount, setAmount] = useState<string>(() => suggestAmount(submission));
  const [description, setDescription] = useState<string>(
    `VireCRM — ${submission.project_type ?? "project"}${submission.company ? ` for ${submission.company}` : ""}`,
  );
  const [dueDays, setDueDays] = useState<string>("14");

  // Tracks whether the admin has manually edited the amount. Once they have,
  // we stop overwriting it when they switch plans — the override sticks.
  const [amountOverridden, setAmountOverridden] = useState(false);

  // When ON, we also call admin_set_org_plan_by_email after the invoice is
  // created so the assignment lands in the customer's org. Defaults ON for
  // any plan that's actually invoiceable.
  const [assignPlan, setAssignPlan] = useState(true);
  const [assigningPlan, setAssigningPlan] = useState(false);

  // Sync the form fields whenever the plan picker changes so the admin
  // sees what will actually be billed before pressing Send. Skip the amount
  // sync once the admin has overridden it manually.
  useEffect(() => {
    if (!selectedPlan) return;
    if (!amountOverridden) {
      setAmount((planTotalCents(selectedPlan) / 100).toFixed(2));
    }
    setDescription(`${selectedPlan.label} plan — ${submission.company ?? submission.name}`);
  }, [selectedPlan, submission.company, submission.name, amountOverridden]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_invoices")
      .select(
        "id, stripe_invoice_id, hosted_invoice_url, invoice_pdf, number, amount_due_cents, amount_paid_cents, currency, status, due_date, paid_at, voided_at, sent_at, environment, created_at",
      )
      .eq("submission_id", submission.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to load invoices");
      return;
    }
    setInvoices((data ?? []) as PlatformInvoiceRow[]);
  };

  useEffect(() => {
    void load();
    // Realtime: refresh when this submission's invoice rows change.
    const channel = supabase
      .channel(`platform_invoices:${submission.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_invoices",
          filter: `submission_id=eq.${submission.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission.id]);

  // Shared helper — assign or remove the plan on whatever org owns this
  // submission's email. Used both from the "Assign plan" toggle in the
  // invoice form and the standalone Reassign / Remove controls below.
  const setPlanForCustomer = async (plan: string): Promise<boolean> => {
    setAssigningPlan(true);
    const { data, error } = await supabase.rpc("admin_set_org_plan_by_email", {
      p_email: submission.email,
      p_plan: plan,
    });
    setAssigningPlan(false);
    if (error) {
      toast.error(error.message ?? "Failed to update plan");
      return false;
    }
    if (!data) {
      toast.message("No customer account found for this email yet — invoice still sent.");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    let lineItems: { description: string; amount_cents: number; quantity?: number }[];
    if (selectedPlan) {
      // If the admin manually overrode the amount, ignore the plan's preset
      // line items and bill exactly what they typed (single line item).
      if (amountOverridden) {
        const dollars = parseFloat(amount);
        if (!isFinite(dollars) || dollars < 0.5) {
          toast.error("Enter an amount of at least $0.50");
          return;
        }
        lineItems = [
          {
            description: description || `${selectedPlan.label} plan (custom amount)`,
            amount_cents: Math.round(dollars * 100),
            quantity: 1,
          },
        ];
      } else {
        lineItems = planLineItems(selectedPlan);
        if (lineItems.length === 0) {
          toast.error("This plan has no billable amount.");
          return;
        }
      }
    } else {
      const dollars = parseFloat(amount);
      if (!isFinite(dollars) || dollars < 0.5) {
        toast.error("Enter an amount of at least $0.50");
        return;
      }
      lineItems = [{ description, amount_cents: Math.round(dollars * 100), quantity: 1 }];
    }

    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-submission-invoice", {
      body: {
        submissionId: submission.id,
        description,
        dueDays: parseInt(dueDays, 10) || 14,
        environment: stripeEnv,
        send: true,
        lineItems,
        ...(selectedPlan && assignPlan && selectedPlan.invoiceable
          ? { grantPlan: selectedPlan.value }
          : {}),
      },
    });
    setCreating(false);
    if (error || (data as { error?: string })?.error) {
      toast.error(
        (data as { error?: string })?.error ?? error?.message ?? "Failed to create invoice",
      );
      return;
    }
    toast.success("Invoice created and sent");

    // Optionally assign the plan to the customer's org. Best-effort — if the
    // user hasn't signed up yet, the helper returns null and we just notify.
    if (selectedPlan && assignPlan && selectedPlan.invoiceable) {
      const ok = await setPlanForCustomer(selectedPlan.value);
      if (ok) toast.success(`Assigned ${selectedPlan.label} plan to ${submission.email}`);
    }

    setShowForm(false);
    void load();
  };

  const onPlanAssignChange = (v: string) => {
    void (async () => {
      if (v === "__remove__") {
        const ok = await confirm({
          title: `Remove plan from ${submission.email}?`,
          description: "They'll be downgraded to Free.",
          confirmLabel: "Remove plan",
          destructive: true,
        });
        if (!ok) return;
        const success = await setPlanForCustomer("free");
        if (success) toast.success("Plan removed (set to Free)");
        return;
      }
      const target = getPlan(v);
      if (target && target.value !== "free") {
        const ok = await confirm({
          title: `Assign "${target.label}" (${formatPlanPrice(target)}) to ${submission.email}?`,
          description: `${target.tagline}\n\nThis grants access immediately and does NOT charge them.`,
          confirmLabel: "Assign plan",
        });
        if (!ok) return;
      }
      const success = await setPlanForCustomer(v);
      if (success) toast.success(`Assigned ${target?.label ?? v}`);
    })();
  };

  return (
    <div className="space-y-2 pt-3 border-t border-border mt-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Stripe Invoice{" "}
          {stripeEnv === "sandbox" ? (
            <Badge variant="outline" className="ml-2 text-[10px]">
              test mode
            </Badge>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Select disabled={assigningPlan} onValueChange={onPlanAssignChange}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue placeholder={assigningPlan ? "Updating…" : "Assign / remove plan"} />
            </SelectTrigger>
            <SelectContent>
              {PLAN_CATALOG.map((p) => (
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
              <SelectItem value="__remove__">Remove plan (downgrade to Free)</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm
              ? "Cancel"
              : invoices && invoices.length > 0
                ? "+ New Invoice"
                : "Create Invoice"}
          </Button>
        </div>
      </div>

      {showForm ? (
        <SubmissionInvoiceForm
          submission={submission}
          suggestion={suggestion}
          planValue={planValue}
          setPlanValue={setPlanValue}
          selectedPlan={selectedPlan}
          amount={amount}
          setAmount={setAmount}
          description={description}
          setDescription={setDescription}
          dueDays={dueDays}
          setDueDays={setDueDays}
          assignPlan={assignPlan}
          setAssignPlan={setAssignPlan}
          setAmountOverridden={setAmountOverridden}
          creating={creating}
          onSubmit={() => void handleCreate()}
        />
      ) : null}

      {loading && !invoices ? (
        <div className="text-xs text-muted-foreground">Loading invoices…</div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="text-xs text-muted-foreground">No invoices yet.</div>
      ) : (
        <div className="space-y-1.5">
          {invoices.map((inv) => (
            <SubmissionInvoiceListItem
              key={inv.id}
              inv={inv}
              actingId={actingId}
              onAction={runInvoiceAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
