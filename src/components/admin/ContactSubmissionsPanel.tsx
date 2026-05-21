import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Loader2, RefreshCw, Search, CreditCard, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  PLAN_CATALOG,
  getPlan,
  planLineItems,
  planTotalCents,
  type PlanCatalogEntry,
} from "@/lib/plan-catalog";
import { useConfirm } from "@/hooks/useConfirm";
import { formatPlanPrice, planBadgeVariant } from "@/lib/admin-utils";
import type { AdminSubmissionRow, PlatformInvoiceRow, PaymentHistoryResult } from "@/types/admin";

// Detected once at module load — `import.meta.env` is statically baked by
// Vite at build time, so this is effectively a constant.
const stripeEnv: "sandbox" | "live" = (
  import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined
)?.startsWith("pk_live_")
  ? "live"
  : "sandbox";

// Stripe-invoice status variant. Broader than `subStatusVariant` in
// admin-utils — covers `open`, `void`, `uncollectible`, etc. Kept inline
// because only the submission flow + FinancialsPanel need it; sharing
// the same name in admin-utils would conflict with the subscription-status
// variant.
function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") return "default";
  if (status === "void" || status === "uncollectible") return "destructive";
  if (status === "open" || status === "sent" || status === "finalized") return "secondary";
  return "outline";
}

export function ContactSubmissionsPanel() {
  const [rows, setRows] = useState<AdminSubmissionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_submissions")
      .select(
        "id, name, email, company, phone, project_type, budget, message, status, origin, test_mode, sentiment, topic, intent_summary, priority_suggestion, metadata, created_at, replied_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to load submissions");
      return;
    }
    setRows((data ?? []) as AdminSubmissionRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.company ?? "").toLowerCase().includes(q) ||
        (r.project_type ?? "").toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setStatus = async (id: string, status: string) => {
    setSavingId(id);
    const patch: { status: string; replied_at?: string } = { status };
    if (status === "replied") patch.replied_at = new Date().toISOString();
    const { error } = await supabase.from("contact_submissions").update(patch).eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error(error.message ?? "Failed to update");
      return;
    }
    toast.success(`Marked ${status}`);
    setRows((prev) =>
      prev
        ? prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  replied_at: status === "replied" ? new Date().toISOString() : r.replied_at,
                }
              : r,
          )
        : prev,
    );
  };

  // Mailto invoice flow stayed handy for non-Stripe customers.
  const buildInvoiceMailto = (s: AdminSubmissionRow) => {
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
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Contact Submissions</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest 200 inquiries. Click a row to see the full message, AI classification, and send
            an invoice.
            {rows ? (
              <>
                {" "}
                Showing {filtered.length} of {rows.length}.
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search submissions…"
              className="w-56 pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !rows ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No submissions match.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const isOpen = expanded.has(s.id);
                  return (
                    <Fragment key={s.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => toggleRow(s.id)}
                      >
                        <TableCell>
                          <div className="font-medium text-foreground">{s.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{s.email}</div>
                          {s.test_mode ? (
                            <Badge variant="outline" className="mt-1 text-[10px]">
                              test
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>{s.company ?? "—"}</TableCell>
                        <TableCell>
                          {s.project_type ? <Badge variant="outline">{s.project_type}</Badge> : "—"}
                        </TableCell>
                        <TableCell>{s.budget ?? "—"}</TableCell>
                        <TableCell>
                          {s.priority_suggestion ? (
                            <Badge
                              variant={
                                s.priority_suggestion === "critical" ||
                                s.priority_suggestion === "high"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {s.priority_suggestion}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.status === "replied" ? "default" : "secondary"}>
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                      {isOpen ? (
                        <TableRow key={`${s.id}-detail`} className="bg-muted/20">
                          <TableCell colSpan={7} className="p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <div className="text-xs font-semibold uppercase text-muted-foreground">
                                  Contact
                                </div>
                                <div className="text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Email:</span>{" "}
                                    <a
                                      href={`mailto:${s.email}`}
                                      className="text-primary hover:underline"
                                    >
                                      {s.email}
                                    </a>
                                  </div>
                                  {s.phone ? (
                                    <div>
                                      <span className="text-muted-foreground">Phone:</span>{" "}
                                      <a
                                        href={`tel:${s.phone}`}
                                        className="text-primary hover:underline"
                                      >
                                        {s.phone}
                                      </a>
                                    </div>
                                  ) : null}
                                  {s.company ? (
                                    <div>
                                      <span className="text-muted-foreground">Company:</span>{" "}
                                      {s.company}
                                    </div>
                                  ) : null}
                                  {s.origin ? (
                                    <div>
                                      <span className="text-muted-foreground">Origin:</span>{" "}
                                      <span className="font-mono text-xs">{s.origin}</span>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="text-xs font-semibold uppercase text-muted-foreground pt-2">
                                  Message
                                </div>
                                <div className="whitespace-pre-wrap rounded border border-border bg-background p-3 text-sm">
                                  {s.message}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="text-xs font-semibold uppercase text-muted-foreground">
                                  AI Classification
                                </div>
                                <div className="text-sm space-y-1">
                                  <div>
                                    <span className="text-muted-foreground">Topic:</span>{" "}
                                    {s.topic ?? "—"}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Sentiment:</span>{" "}
                                    {s.sentiment ?? "—"}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Priority:</span>{" "}
                                    {s.priority_suggestion ?? "—"}
                                  </div>
                                  {s.intent_summary ? (
                                    <div className="pt-1">
                                      <div className="text-muted-foreground">Intent:</div>
                                      <div className="rounded border border-border bg-background p-2 text-xs">
                                        {s.intent_summary}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                                {s.metadata && Object.keys(s.metadata).length > 0 ? (
                                  <>
                                    <div className="text-xs font-semibold uppercase text-muted-foreground pt-2">
                                      Metadata
                                    </div>
                                    <pre className="overflow-x-auto rounded border border-border bg-background p-2 text-[11px] leading-relaxed">
                                      {JSON.stringify(s.metadata, null, 2)}
                                    </pre>
                                  </>
                                ) : null}
                                <div className="flex flex-wrap gap-2 pt-3">
                                  <Button asChild size="sm" variant="outline">
                                    <a href={`mailto:${s.email}`}>Reply</a>
                                  </Button>
                                  <Button asChild size="sm" variant="ghost">
                                    <a href={buildInvoiceMailto(s)}>Email Invoice (manual)</a>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={savingId === s.id || s.status === "replied"}
                                    onClick={() => void setStatus(s.id, "replied")}
                                  >
                                    Mark Replied
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={savingId === s.id || s.status === "archived"}
                                    onClick={() => void setStatus(s.id, "archived")}
                                  >
                                    Archive
                                  </Button>
                                </div>
                                {s.replied_at ? (
                                  <div className="text-xs text-muted-foreground pt-1">
                                    Replied{" "}
                                    {formatDistanceToNow(new Date(s.replied_at), {
                                      addSuffix: true,
                                    })}
                                  </div>
                                ) : null}
                                <SubmissionPaymentHistory submission={s} />
                                <SubmissionInvoicePanel submission={s} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------- Stripe Invoice for a Submission ------------------- */

function SubmissionPaymentHistory({ submission }: { submission: AdminSubmissionRow }) {
  const [data, setData] = useState<PaymentHistoryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: res, error } = await supabase.rpc("admin_submission_payment_history", {
      p_submission_id: submission.id,
    });
    if (error) toast.error("Could not load payment history", { description: error.message });
    else setData(res as unknown as PaymentHistoryResult);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission.id]);

  const fmt = (c: number, cur = "usd") => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur.toUpperCase(),
      }).format((c || 0) / 100);
    } catch {
      return `$${((c || 0) / 100).toFixed(2)}`;
    }
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 mt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CreditCard className="h-4 w-4 text-primary" />
          Payment history
          {data?.stripe_customer_ids && data.stripe_customer_ids.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              linked Stripe customer
            </Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-7 gap-1">
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>

      {data && data.invoices.length > 0 && (
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Invoices</div>
            <div className="font-semibold text-foreground">{data.totals.invoices ?? 0}</div>
          </div>
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Paid</div>
            <div className="font-semibold text-emerald-400">{fmt(data.totals.paid_cents ?? 0)}</div>
          </div>
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Outstanding</div>
            <div className="font-semibold text-amber-400">
              {fmt(data.totals.outstanding_cents ?? 0)}
            </div>
          </div>
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Stripe customers</div>
            <div className="font-mono text-[10px] text-foreground truncate">
              {data.stripe_customer_ids?.[0] || "—"}
            </div>
          </div>
        </div>
      )}

      {data && data.invoices.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No prior invoices for {data.email || submission.email}. The next invoice will create a
          Stripe customer that future submissions from this email will reuse.
        </p>
      ) : data ? (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Env</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.invoices.map((iv) => (
              <TableRow key={iv.id}>
                <TableCell className="text-xs">
                  <div className="text-foreground">
                    {iv.number || iv.stripe_invoice_id || iv.id.slice(0, 8)}
                  </div>
                  {iv.description && (
                    <div className="text-muted-foreground line-clamp-1">{iv.description}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="text-foreground">{fmt(iv.amount_due_cents, iv.currency)}</div>
                  {iv.amount_paid_cents > 0 && (
                    <div className="text-emerald-400">
                      paid {fmt(iv.amount_paid_cents, iv.currency)}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(iv.status)}>{iv.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {iv.environment}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(iv.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  {iv.hosted_invoice_url ? (
                    <a
                      href={iv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}

function SubmissionInvoicePanel({ submission }: { submission: AdminSubmissionRow }) {
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
          <Select
            disabled={assigningPlan}
            onValueChange={(v) => {
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
            }}
          >
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
                <code className="rounded bg-muted px-1">project_type</code> matched a known plan
                tier.
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
            <Button onClick={() => void handleCreate()} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invoice"}
            </Button>
          </div>
        </div>
      ) : null}

      {loading && !invoices ? (
        <div className="text-xs text-muted-foreground">Loading invoices…</div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="text-xs text-muted-foreground">No invoices yet.</div>
      ) : (
        <div className="space-y-1.5">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-2 rounded border border-border bg-background p-2 text-sm"
            >
              <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {inv.number ?? inv.stripe_invoice_id}
              </span>
              <span className="tabular-nums">
                ${(inv.amount_due_cents / 100).toFixed(2)} {inv.currency.toUpperCase()}
              </span>
              {inv.amount_paid_cents > 0 ? (
                <span className="text-xs text-muted-foreground">
                  paid ${(inv.amount_paid_cents / 100).toFixed(2)}
                </span>
              ) : null}
              {inv.environment === "sandbox" ? (
                <Badge variant="outline" className="text-[10px]">
                  test
                </Badge>
              ) : null}
              <span className="ml-auto flex gap-2">
                {inv.hosted_invoice_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
                      Payment link
                    </a>
                  </Button>
                ) : null}
                {inv.invoice_pdf ? (
                  <Button asChild size="sm" variant="outline" title="Download invoice PDF">
                    <a
                      href={inv.invoice_pdf}
                      download={`invoice-${inv.number ?? inv.stripe_invoice_id ?? inv.id}.pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </a>
                  </Button>
                ) : null}
                {inv.status !== "void" && inv.status !== "paid" && inv.status !== "refunded" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actingId === inv.id}
                    onClick={() => void runInvoiceAction(inv, "resend")}
                    title="Resend the Stripe-hosted invoice email to the prospect"
                  >
                    {actingId === inv.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Resend email"
                    )}
                  </Button>
                ) : null}
                {inv.status !== "void" && inv.status !== "paid" && inv.status !== "refunded" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={actingId === inv.id}
                    onClick={() => void runInvoiceAction(inv, "void")}
                  >
                    {actingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Void"}
                  </Button>
                ) : null}
                {inv.amount_paid_cents > 0 && inv.status !== "refunded" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-amber-400 hover:text-amber-300"
                    disabled={actingId === inv.id}
                    onClick={() => void runInvoiceAction(inv, "refund")}
                  >
                    {actingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refund"}
                  </Button>
                ) : null}
              </span>
              <div className="w-full text-[11px] text-muted-foreground">
                Created {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                {inv.paid_at ? (
                  <> · paid {formatDistanceToNow(new Date(inv.paid_at), { addSuffix: true })}</>
                ) : null}
                {inv.due_date && !inv.paid_at ? (
                  <> · due {new Date(inv.due_date).toLocaleDateString()}</>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders which submission metadata fields the suggestion engine considered,
 * highlighting the one that drove the chosen plan (when there is a match).
 */
function SuggestionSignals({
  submission,
  source,
}: {
  submission: AdminSubmissionRow;
  source: "interested_plan" | "budget" | "project_type" | null;
}) {
  const interestedPlan =
    (typeof submission.metadata?.["interested_plan"] === "string"
      ? (submission.metadata["interested_plan"] as string)
      : typeof submission.metadata?.["plan"] === "string"
        ? (submission.metadata["plan"] as string)
        : null) ?? null;

  const fields: Array<{
    key: "interested_plan" | "budget" | "project_type";
    label: string;
    value: string | null;
  }> = [
    { key: "interested_plan", label: "interested_plan", value: interestedPlan },
    { key: "budget", label: "budget", value: submission.budget ?? null },
    { key: "project_type", label: "project_type", value: submission.project_type ?? null },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f) => {
        const matched = source === f.key;
        const empty = !f.value;
        return (
          <span
            key={f.key}
            className={
              matched
                ? "inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] text-foreground"
                : empty
                  ? "inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground/70"
                  : "inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            }
            title={
              matched
                ? "This field drove the suggestion"
                : empty
                  ? "Not provided"
                  : "Considered, no match"
            }
          >
            <code className="font-mono text-[10px]">{f.label}</code>
            <span className="text-foreground/80">{empty ? "—" : f.value}</span>
            {matched ? <span className="text-primary">✓ used</span> : null}
          </span>
        );
      })}
    </div>
  );
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
function suggestPlanForSubmission(s: AdminSubmissionRow): {
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
function suggestAmount(s: AdminSubmissionRow): string {
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
