import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  FileText,
  Loader2,
  ExternalLink,
  Plus,
  Receipt,
  Repeat,
  XCircle,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { NewLeadInvoiceDialog } from "@/components/crm/NewLeadInvoiceDialog";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/invoices")({
  component: InvoicesPage,
  head: () => ({
    meta: [
      { title: "VireCRM — Invoices" },
      { name: "description", content: "Send and track custom Stripe invoices to leads" },
    ],
  }),
});

interface LeadInvoice {
  id: string;
  number: string | null;
  description: string | null;
  amount_due_cents: number;
  amount_paid_cents: number;
  currency: string;
  status: string;
  is_recurring: boolean;
  interval: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  lead_id: string | null;
  leads: { name: string; email: string | null; company: string | null } | null;
}

interface Transaction {
  id: string;
  stripe_transaction_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  billed_at: string;
  environment: string;
}

const LEAD_STATUS: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  paid: { variant: "default", label: "Paid" },
  open: { variant: "secondary", label: "Awaiting payment" },
  draft: { variant: "outline", label: "Draft" },
  void: { variant: "destructive", label: "Voided" },
  uncollectible: { variant: "destructive", label: "Uncollectible" },
  active: { variant: "default", label: "Active" },
  past_due: { variant: "destructive", label: "Past due" },
  canceled: { variant: "outline", label: "Canceled" },
};

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function InvoicesPage() {
  const { user, organization, role } = useAuth();
  const [tab, setTab] = useState<"leads" | "subscriptions">("leads");
  const [leadInvoices, setLeadInvoices] = useState<LeadInvoice[]>([]);
  const [loadingLead, setLoadingLead] = useState(true);
  const [accountReady, setAccountReady] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "paid" | "recurring" | "void">("all");

  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(true);

  const isOwner = role?.role === "owner";

  const refreshLeadInvoices = useCallback(async () => {
    if (!organization?.id) return;
    setLoadingLead(true);
    const [{ data: invs }, { data: acc }] = await Promise.all([
      supabase
        .from("client_invoices")
        .select(
          "id, number, description, amount_due_cents, amount_paid_cents, currency, status, is_recurring, interval, hosted_invoice_url, invoice_pdf, due_date, sent_at, paid_at, created_at, lead_id, leads(name, email, company)",
        )
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("client_stripe_accounts")
        .select("charges_enabled")
        .eq("organization_id", organization.id)
        .maybeSingle(),
    ]);
    setLeadInvoices((invs || []) as unknown as LeadInvoice[]);
    setAccountReady(Boolean(acc?.charges_enabled));
    setLoadingLead(false);
  }, [organization?.id]);

  useEffect(() => {
    void refreshLeadInvoices();
  }, [refreshLeadInvoices]);

  // Realtime — keep status fresh as Stripe webhooks update rows
  useEffect(() => {
    if (!organization?.id) return;
    const channel = supabase
      .channel(`client_invoices_${organization.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_invoices",
          filter: `organization_id=eq.${organization.id}`,
        },
        () => void refreshLeadInvoices(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organization?.id, refreshLeadInvoices]);

  useEffect(() => {
    if (!user?.id) {
      setLoadingTxns(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingTxns(true);
      const { data } = await supabase
        .from("transactions")
        .select("id,stripe_transaction_id,amount_cents,currency,status,billed_at,environment")
        .eq("user_id", user.id)
        .order("billed_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      setTxns((data ?? []) as Transaction[]);
      setLoadingTxns(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    let collected = 0;
    let outstanding = 0;
    let recurring = 0;
    let voided = 0;
    for (const inv of leadInvoices) {
      if (inv.status === "paid") collected += inv.amount_paid_cents || inv.amount_due_cents;
      else if (inv.status === "open" || inv.status === "past_due")
        outstanding += inv.amount_due_cents;
      if (inv.is_recurring && (inv.status === "active" || inv.status === "open")) recurring += 1;
      if (inv.status === "void" || inv.status === "canceled") voided += 1;
    }
    return { collected, outstanding, recurring, voided };
  }, [leadInvoices]);

  const filtered = useMemo(() => {
    if (filter === "all") return leadInvoices;
    if (filter === "recurring") return leadInvoices.filter((i) => i.is_recurring);
    if (filter === "open")
      return leadInvoices.filter((i) => i.status === "open" || i.status === "past_due");
    if (filter === "paid") return leadInvoices.filter((i) => i.status === "paid");
    if (filter === "void")
      return leadInvoices.filter((i) => i.status === "void" || i.status === "canceled");
    return leadInvoices;
  }, [leadInvoices, filter]);

  const currency = leadInvoices[0]?.currency ?? "USD";

  const voidInvoice = async (id: string) => {
    if (!confirm("Void this invoice? The lead will be notified the charge is canceled.")) return;
    const { error, data } = await supabase.functions.invoke("void-lead-invoice", {
      body: { invoiceId: id, environment: getStripeEnvironment() },
    });
    if (error || (data as { error?: string } | null)?.error) {
      toast.error((data as { error?: string } | null)?.error || error?.message || "Failed");
      return;
    }
    toast.success("Invoice voided");
    void refreshLeadInvoices();
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send custom Stripe invoices to your leads and track payments in real time
            </p>
          </div>
          <div className="flex gap-2">
            {isOwner && accountReady && (
              <Button variant="command" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New invoice
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/billing" search={{ required: undefined, plan: undefined }}>
                <CreditCard className="h-4 w-4" />
                My billing
              </Link>
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="leads" className="gap-2">
              <Receipt className="h-4 w-4" />
              Lead invoices
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2">
              <CreditCard className="h-4 w-4" />
              My subscription payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="space-y-6">
            {accountReady === false ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <CreditCard className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-3 font-semibold text-foreground">
                  Connect Stripe to send invoices
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Link your own Stripe account so payments from leads land directly in your bank.
                </p>
                <Button variant="command" className="mt-4" asChild>
                  <Link to="/settings">
                    Set up Stripe
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatCard
                    icon={DollarSign}
                    label="Collected"
                    value={formatMoney(stats.collected, currency)}
                    tone="success"
                  />
                  <StatCard
                    icon={Clock}
                    label="Outstanding"
                    value={formatMoney(stats.outstanding, currency)}
                    tone="warning"
                  />
                  <StatCard
                    icon={Repeat}
                    label="Recurring"
                    value={String(stats.recurring)}
                    sub="active subscriptions"
                  />
                  <StatCard
                    icon={XCircle}
                    label="Voided"
                    value={String(stats.voided)}
                    sub="canceled invoices"
                  />
                </div>

                <div className="rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-5 py-3">
                    <h2 className="font-semibold text-foreground">All lead invoices</h2>
                    <div className="flex gap-1">
                      {(["all", "open", "paid", "recurring", "void"] as const).map((f) => (
                        <Button
                          key={f}
                          variant={filter === f ? "secondary" : "ghost"}
                          size="sm"
                          className="text-xs capitalize"
                          onClick={() => setFilter(f)}
                        >
                          {f}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {loadingLead ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                      <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                      <p className="mt-3 text-sm font-medium text-foreground">
                        {leadInvoices.length === 0
                          ? "No invoices yet"
                          : "Nothing matches this filter"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {leadInvoices.length === 0
                          ? "Send your first custom invoice to a lead."
                          : "Try a different filter."}
                      </p>
                      {isOwner && accountReady && leadInvoices.length === 0 && (
                        <Button
                          variant="command"
                          size="sm"
                          className="mt-4"
                          onClick={() => setDialogOpen(true)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          New invoice
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filtered.map((inv) => {
                        const cfg = LEAD_STATUS[inv.status] ?? {
                          variant: "outline" as const,
                          label: inv.status,
                        };
                        return (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                {inv.is_recurring ? (
                                  <Repeat className="h-5 w-5 text-primary" />
                                ) : (
                                  <FileText className="h-5 w-5 text-primary" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground truncate">
                                    {inv.leads?.name || "Unknown lead"}
                                  </span>
                                  {inv.leads?.company && (
                                    <span className="text-xs text-muted-foreground">
                                      · {inv.leads.company}
                                    </span>
                                  )}
                                  {inv.number && (
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                      #{inv.number}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {inv.description || "—"} ·{" "}
                                  {new Date(inv.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-4">
                              <div className="text-right">
                                <p className="font-semibold text-foreground">
                                  {formatMoney(inv.amount_due_cents, inv.currency)}
                                </p>
                                {inv.amount_paid_cents > 0 && inv.status !== "paid" ? (
                                  <p className="text-[10px] text-primary">
                                    {formatMoney(inv.amount_paid_cents, inv.currency)} collected
                                  </p>
                                ) : inv.status === "paid" && inv.paid_at ? (
                                  <p className="text-[10px] text-muted-foreground">
                                    Paid {new Date(inv.paid_at).toLocaleDateString()}
                                  </p>
                                ) : inv.is_recurring ? (
                                  <p className="text-[10px] text-muted-foreground">
                                    per {inv.interval || "month"}
                                  </p>
                                ) : inv.due_date ? (
                                  <p className="text-[10px] text-muted-foreground">
                                    Due {new Date(inv.due_date).toLocaleDateString()}
                                  </p>
                                ) : null}
                              </div>
                              <Badge
                                variant={cfg.variant}
                                className="min-w-[110px] justify-center text-xs"
                              >
                                {cfg.label}
                              </Badge>
                              <div className="flex flex-col items-end gap-1 min-w-[80px]">
                                {inv.invoice_pdf && (
                                  <a
                                    href={inv.invoice_pdf}
                                    target="_blank"
                                    rel="noreferrer"
                                    download
                                    className="text-xs text-foreground hover:text-primary hover:underline inline-flex items-center gap-1"
                                    title="Download invoice PDF"
                                  >
                                    <Download className="h-3 w-3" /> PDF
                                  </a>
                                )}
                                {inv.hosted_invoice_url && (
                                  <a
                                    href={inv.hosted_invoice_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" /> View
                                  </a>
                                )}
                                {isOwner &&
                                  ["open", "draft", "active", "past_due"].includes(inv.status) && (
                                    <button
                                      onClick={() => voidInvoice(inv.id)}
                                      className="text-xs text-destructive hover:underline"
                                    >
                                      Void
                                    </button>
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="subscriptions">
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="font-semibold text-foreground">My subscription payments</h2>
                <p className="text-xs text-muted-foreground">
                  Charges for your own VireCRM plan. To send invoices to leads, use the Lead
                  invoices tab.
                </p>
              </div>
              {loadingTxns ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : txns.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium text-foreground">No transactions yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Subscription charges will show up here once a payment goes through.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {txns.map((txn) => {
                    const isPaid = txn.status === "completed" || txn.status === "paid";
                    return (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between gap-4 px-5 py-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <CreditCard className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Subscription payment
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(txn.billed_at).toLocaleString()}
                              {txn.environment === "sandbox" && " · test mode"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold">
                            {formatMoney(txn.amount_cents, txn.currency)}
                          </span>
                          <Badge variant={isPaid ? "default" : "secondary"} className="text-xs">
                            {isPaid ? (
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                            ) : txn.status === "failed" ? (
                              <AlertCircle className="mr-1 h-3 w-3" />
                            ) : (
                              <Clock className="mr-1 h-3 w-3" />
                            )}
                            {txn.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <NewLeadInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refreshLeadInvoices}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "warning";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
