import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Loader2,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  CheckCheck,
  Receipt,
  ArrowDownCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/clients/payouts")({
  component: PayoutsPage,
  head: () => ({
    meta: [
      { title: "Payouts — Vireon" },
      { name: "description", content: "View your reseller commission payouts" },
    ],
  }),
});

interface PayoutRow {
  id: string;
  period_start: string;
  period_end: string;
  gross_revenue_cents: number;
  commission_rate: number;
  commission_cents: number;
  currency: string;
  active_client_count: number;
  status: "pending" | "paid" | "void";
  paid_at: string | null;
  payment_reference: string | null;
}

interface LineItem {
  id: string;
  client_name: string | null;
  amount_cents: number;
  base_cost_cents: number;
  markup_cents: number;
  commission_cents: number;
}

interface AttributedTransaction {
  id: string;
  paddle_transaction_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  billed_at: string;
  client_name: string | null;
  payout_period_start: string | null;
  payout_status: PayoutRow["status"] | null;
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
  // BOM so Excel reads UTF-8 correctly
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function PayoutsPage() {
  const { organization, role } = useAuth();
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<Record<string, LineItem[]>>({});
  const [payDialogPayout, setPayDialogPayout] = useState<PayoutRow | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [marking, setMarking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"payouts" | "transactions">("payouts");
  const [transactions, setTransactions] = useState<AttributedTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);

  const isOwner = role?.role === "owner";
  const isReseller = !!(organization as { is_reseller?: boolean } | null)?.is_reseller;

  useEffect(() => {
    if (!organization?.id || !isOwner || !isReseller) {
      setLoading(false);
      return;
    }
    void loadPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, isOwner, isReseller]);

  useEffect(() => {
    if (activeTab !== "transactions") return;
    if (!organization?.id || !isOwner || !isReseller) return;
    if (transactionsLoaded) return;
    void loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, organization?.id, isOwner, isReseller, transactionsLoaded]);

  const loadPayouts = async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reseller_payouts")
      .select("*")
      .eq("reseller_id", organization.id)
      .order("period_start", { ascending: false });
    if (error) {
      toast.error("Failed to load payouts: " + error.message);
    } else {
      setPayouts((data || []) as PayoutRow[]);
    }
    setLoading(false);
  };

  const loadTransactions = async () => {
    if (!organization?.id) return;
    setTransactionsLoading(true);
    try {
      // Pull the last 12 months of attributed transactions (RLS limits to this reseller).
      const { data: txData, error: txErr } = await supabase
        .from("transactions")
        .select("id, paddle_transaction_id, amount_cents, currency, status, billed_at, user_id")
        .eq("attributed_reseller_id", organization.id)
        .order("billed_at", { ascending: false })
        .limit(500);
      if (txErr) throw txErr;
      const txRows = (txData || []) as Array<{
        id: string;
        paddle_transaction_id: string;
        amount_cents: number;
        currency: string;
        status: string;
        billed_at: string;
        user_id: string | null;
      }>;

      // Resolve client org name per user_id (one round-trip).
      const userIds = Array.from(
        new Set(txRows.map((t) => t.user_id).filter((u): u is string => !!u)),
      );
      const userIdToClientName = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, organization_id, organizations:organization_id(name)")
          .in("user_id", userIds);
        for (const p of (profiles || []) as Array<{
          user_id: string;
          organizations: { name: string } | null;
        }>) {
          if (p.organizations?.name) userIdToClientName.set(p.user_id, p.organizations.name);
        }
      }

      // Map each transaction to its calendar-month payout (matches calculate_reseller_payouts).
      const periodToPayout = new Map<
        string,
        { period_start: string; status: PayoutRow["status"] }
      >();
      for (const p of payouts) {
        // payouts already loaded; use period_start as YYYY-MM key
        periodToPayout.set(p.period_start.slice(0, 7), {
          period_start: p.period_start,
          status: p.status,
        });
      }

      const enriched: AttributedTransaction[] = txRows.map((t) => {
        const monthKey = t.billed_at.slice(0, 7);
        const payout = periodToPayout.get(monthKey) || null;
        return {
          id: t.id,
          paddle_transaction_id: t.paddle_transaction_id,
          amount_cents: t.amount_cents,
          currency: t.currency,
          status: t.status,
          billed_at: t.billed_at,
          client_name: t.user_id ? (userIdToClientName.get(t.user_id) ?? null) : null,
          payout_period_start: payout?.period_start ?? null,
          payout_status: payout?.status ?? null,
        };
      });
      setTransactions(enriched);
      setTransactionsLoaded(true);
    } catch (err) {
      toast.error(
        "Failed to load transactions: " + (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setTransactionsLoading(false);
    }
  };

  const toggleExpand = async (payoutId: string) => {
    if (expandedId === payoutId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(payoutId);
    if (!lineItems[payoutId]) {
      const { data, error } = await supabase
        .from("payout_line_items")
        .select("id, client_name, amount_cents, base_cost_cents, markup_cents, commission_cents")
        .eq("payout_id", payoutId);
      if (error) {
        toast.error("Failed to load line items");
        return;
      }
      setLineItems((prev) => ({ ...prev, [payoutId]: (data || []) as LineItem[] }));
    }
  };

  const openPayDialog = (e: React.MouseEvent, payout: PayoutRow) => {
    e.stopPropagation();
    setPayDialogPayout(payout);
    setPaymentReference("");
  };

  const confirmMarkPaid = async () => {
    if (!payDialogPayout) return;
    setMarking(true);
    const { data, error } = await supabase.rpc("mark_payout_paid", {
      p_payout_id: payDialogPayout.id,
      p_payment_reference: paymentReference || undefined,
    });
    setMarking(false);
    if (error) {
      toast.error("Failed: " + error.message);
      return;
    }
    const result = data as { success: boolean; error?: string } | null;
    if (!result?.success) {
      toast.error(result?.error || "Failed to mark paid");
      return;
    }
    toast.success("Payout marked as paid");
    setPayDialogPayout(null);
    setPaymentReference("");
    await loadPayouts();
  };

  const handleExportCsv = async () => {
    if (payouts.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    setExporting(true);
    try {
      // Fetch all line items for all payouts in one query
      const payoutIds = payouts.map((p) => p.id);
      const { data: allLines, error } = await supabase
        .from("payout_line_items")
        .select("payout_id, client_name, amount_cents, commission_cents")
        .in("payout_id", payoutIds);
      if (error) throw error;

      const rows: string[][] = [
        [
          "Period",
          "Status",
          "Active Clients",
          "Gross Revenue",
          "Commission Rate",
          "Commission",
          "Currency",
          "Paid At",
          "Payment Reference",
          "Client",
          "Client Amount",
          "Client Commission",
        ],
      ];

      for (const p of payouts) {
        const period = format(new Date(p.period_start), "yyyy-MM");
        const lines = (allLines || []).filter((l) => l.payout_id === p.id);
        if (lines.length === 0) {
          rows.push([
            period,
            p.status,
            String(p.active_client_count),
            (Number(p.gross_revenue_cents) / 100).toFixed(2),
            (Number(p.commission_rate) * 100).toFixed(2) + "%",
            (Number(p.commission_cents) / 100).toFixed(2),
            p.currency,
            p.paid_at ? format(new Date(p.paid_at), "yyyy-MM-dd HH:mm") : "",
            p.payment_reference || "",
            "",
            "",
            "",
          ]);
        } else {
          for (const li of lines) {
            rows.push([
              period,
              p.status,
              String(p.active_client_count),
              (Number(p.gross_revenue_cents) / 100).toFixed(2),
              (Number(p.commission_rate) * 100).toFixed(2) + "%",
              (Number(p.commission_cents) / 100).toFixed(2),
              p.currency,
              p.paid_at ? format(new Date(p.paid_at), "yyyy-MM-dd HH:mm") : "",
              p.payment_reference || "",
              li.client_name || "Unknown",
              (Number(li.amount_cents) / 100).toFixed(2),
              (Number(li.commission_cents) / 100).toFixed(2),
            ]);
          }
        }
      }

      const filename = `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
      downloadCsv(filename, rows);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error("Export failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  if (!isOwner || !isReseller) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 text-base font-semibold text-foreground">Reseller owners only</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Enable reseller mode and own the organization to view commission payouts.
          </p>
          <Button variant="command" className="mt-4" onClick={() => navigate({ to: "/clients" })}>
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  const totalEarned = payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.commission_cents), 0);
  const pendingTotal = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.commission_cents), 0);
  const lifetimeRevenue = payouts.reduce((sum, p) => sum + Number(p.gross_revenue_cents), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            to="/clients"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Clients
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Payouts
          </h1>
          <p className="text-sm text-muted-foreground">
            Your monthly commission earnings from attributed client subscriptions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={exporting || payouts.length === 0}
          className="gap-2"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Lifetime Earned"
          value={formatCents(totalEarned)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard label="Pending Payout" value={formatCents(pendingTotal)} icon={Clock} />
        <StatCard
          label="Lifetime Client Revenue"
          value={formatCents(lifetimeRevenue)}
          icon={TrendingUp}
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "payouts" | "transactions")}>
        <TabsList className="mb-4">
          <TabsTrigger value="payouts" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Payouts
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payouts" className="mt-0">
          {/* Payouts table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : payouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
              <DollarSign className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <h3 className="mt-4 text-sm font-semibold text-foreground">No payouts yet</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Payouts are calculated on the 1st of each month for client subscriptions attributed to your reseller account.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/30">
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Active Clients</th>
                    <th className="px-4 py-3">Gross Revenue</th>
                    <th className="px-4 py-3">Rate</th>
                    <th className="px-4 py-3">Commission</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <>
                      <tr
                        key={p.id}
                        onClick={() => toggleExpand(p.id)}
                        className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm text-foreground flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {format(new Date(p.period_start), "MMM yyyy")}
                          </div>
                          {p.paid_at && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Paid {format(new Date(p.paid_at), "MMM d, yyyy")}
                              {p.payment_reference && ` · ${p.payment_reference}`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{p.active_client_count}</td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {formatCents(Number(p.gross_revenue_cents), p.currency)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {(Number(p.commission_rate) * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">
                          {formatCents(Number(p.commission_cents), p.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <PayoutStatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.status === "pending" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 h-7 text-xs"
                              onClick={(e) => openPayDialog(e, p)}
                            >
                              <CheckCheck className="h-3 w-3" />
                              Mark paid
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                      {expandedId === p.id && (
                        <tr key={p.id + "-expanded"} className="bg-muted/10 border-b border-border">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                              Line Items
                            </div>
                            {!lineItems[p.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : lineItems[p.id].length === 0 ? (
                              <p className="text-xs text-muted-foreground">No line items recorded.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {lineItems[p.id].map((li) => {
                                  const isRefund = Number(li.amount_cents) < 0;
                                  return (
                                    <div
                                      key={li.id}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <div className="flex items-center gap-2 text-foreground">
                                        {isRefund ? (
                                          <ArrowDownCircle className="h-3 w-3 text-destructive" />
                                        ) : (
                                          <Building2 className="h-3 w-3 text-muted-foreground" />
                                        )}
                                        {li.client_name || "Unknown client"}
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className={isRefund ? "text-destructive" : "text-muted-foreground"}>
                                          {formatCents(Number(li.amount_cents), p.currency)}
                                        </span>
                                        <span className={`font-semibold w-20 text-right ${isRefund ? "text-destructive" : "text-foreground"}`}>
                                          {isRefund ? "" : "+"}{formatCents(Number(li.commission_cents), p.currency)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-0">
          {transactionsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
              <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <h3 className="mt-4 text-sm font-semibold text-foreground">No transactions yet</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Once a client of yours pays for a subscription, the transaction will appear here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/30">
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Transaction ID</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Payout Period</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(new Date(t.billed_at), "MMM d, yyyy")}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(t.billed_at), "HH:mm")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {t.client_name || "Unknown client"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {t.paddle_transaction_id}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">
                        {formatCents(Number(t.amount_cents), t.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={t.status === "completed" ? "secondary" : "outline"} className="text-[10px]">
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {t.payout_period_start ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-foreground">
                              {format(new Date(t.payout_period_start), "MMM yyyy")}
                            </span>
                            {t.payout_status && <PayoutStatusBadge status={t.payout_status} />}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Not yet rolled up</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mark as paid dialog */}
      <Dialog open={!!payDialogPayout} onOpenChange={(o) => !o && setPayDialogPayout(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark payout as paid</DialogTitle>
            <DialogDescription>
              {payDialogPayout && (
                <>
                  Confirm you've received{" "}
                  <span className="font-semibold text-foreground">
                    {formatCents(Number(payDialogPayout.commission_cents), payDialogPayout.currency)}
                  </span>{" "}
                  for {format(new Date(payDialogPayout.period_start), "MMMM yyyy")}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="payment-reference" className="text-xs">
              Payment reference <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="payment-reference"
              placeholder="e.g. Wire #ABC-12345 or Stripe payout ID"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              maxLength={255}
            />
            <p className="text-[10px] text-muted-foreground">
              Useful for reconciling with your bank statement or accountant.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogPayout(null)} disabled={marking}>
              Cancel
            </Button>
            <Button onClick={confirmMarkPaid} disabled={marking} className="gap-1.5">
              {marking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <CheckCheck className="h-3.5 w-3.5" />
              Confirm paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayoutStatusBadge({ status }: { status: PayoutRow["status"] }) {
  if (status === "paid") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Paid
      </Badge>
    );
  }
  if (status === "void") {
    return <Badge variant="outline">Void</Badge>;
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={`h-4 w-4 ${tone === "success" ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}
