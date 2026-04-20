import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  FileText,
  Loader2,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/_app/invoices")({
  component: InvoicesPage,
  head: () => ({
    meta: [
      { title: "Vireon — Invoices" },
      { name: "description", content: "Invoicing, payments, and billing management" },
    ],
  }),
});

interface Transaction {
  id: string;
  stripe_transaction_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  billed_at: string;
  environment: string;
}

const statusConfig: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2; color: string; label: string }
> = {
  completed: { variant: "default", icon: CheckCircle2, color: "text-success", label: "paid" },
  paid: { variant: "default", icon: CheckCircle2, color: "text-success", label: "paid" },
  pending: { variant: "secondary", icon: Clock, color: "text-warning", label: "pending" },
  failed: { variant: "destructive", icon: AlertCircle, color: "text-destructive", label: "failed" },
  refunded: { variant: "outline", icon: FileText, color: "text-muted-foreground", label: "refunded" },
};

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function InvoicesPage() {
  const { user } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "failed">("all");

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("id,stripe_transaction_id,amount_cents,currency,status,billed_at,environment")
        .eq("user_id", user.id)
        .order("billed_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) {
        console.warn("invoices load failed", error);
        setTxns([]);
      } else {
        setTxns((data ?? []) as Transaction[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = monthStart;

    let mtdRevenue = 0;
    let lastMonthRevenue = 0;
    let outstanding = 0;
    let outstandingCount = 0;
    let failed = 0;
    let failedCount = 0;
    let collected = 0;
    let collectedCount = 0;

    for (const t of txns) {
      const billed = new Date(t.billed_at);
      const isPaid = t.status === "completed" || t.status === "paid";
      if (isPaid && billed >= monthStart) {
        mtdRevenue += t.amount_cents;
        collected += t.amount_cents;
        collectedCount += 1;
      }
      if (isPaid && billed >= lastMonthStart && billed < lastMonthEnd) {
        lastMonthRevenue += t.amount_cents;
      }
      if (t.status === "pending") {
        outstanding += t.amount_cents;
        outstandingCount += 1;
      }
      if (t.status === "failed") {
        failed += t.amount_cents;
        failedCount += 1;
      }
    }

    const trend =
      lastMonthRevenue > 0
        ? ((mtdRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : null;

    return {
      mtdRevenue,
      outstanding,
      outstandingCount,
      failed,
      failedCount,
      collected,
      collectedCount,
      trend,
    };
  }, [txns]);

  const currency = txns[0]?.currency ?? "USD";

  const filtered = useMemo(() => {
    if (filter === "all") return txns;
    if (filter === "paid")
      return txns.filter((t) => t.status === "completed" || t.status === "paid");
    return txns.filter((t) => t.status === filter);
  }, [txns, filter]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Invoices & Payments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live transactions from your subscription billing
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/billing" search={{ required: undefined, plan: undefined }}>
              <Button variant="outline" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Manage billing
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Revenue (MTD)</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {formatMoney(stats.mtdRevenue, currency)}
            </p>
            {stats.trend !== null ? (
              <div
                className={`mt-1 flex items-center gap-1 text-xs ${stats.trend >= 0 ? "text-success" : "text-destructive"}`}
              >
                <TrendingUp className="h-3 w-3" />
                {stats.trend >= 0 ? "+" : ""}
                {stats.trend.toFixed(1)}% vs last month
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No prior month data</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-warning">
              {formatMoney(stats.outstanding, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.outstandingCount} pending
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-destructive">
              {formatMoney(stats.failed, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.failedCount} failed
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Collected (MTD)</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-success">
              {formatMoney(stats.collected, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.collectedCount} this month
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Transactions</h2>
            <div className="flex gap-1">
              {(["all", "paid", "pending", "failed"] as const).map((f) => (
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

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {txns.length === 0 ? "No transactions yet" : "No transactions match this filter"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {txns.length === 0
                  ? "Once a subscription payment goes through, it'll show up here."
                  : "Try a different filter."}
              </p>
              {txns.length === 0 && (
                <Link to="/billing" search={{ required: undefined, plan: undefined }}>
                  <Button variant="outline" size="sm" className="mt-4 gap-1">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Go to billing
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((txn) => {
                const cfg = statusConfig[txn.status] ?? statusConfig.pending;
                const StatusIcon = cfg.icon;
                const ref =
                  txn.stripe_transaction_id?.slice(-10).toUpperCase() ??
                  txn.id.slice(0, 8).toUpperCase();
                return (
                  <div
                    key={txn.id}
                    className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{ref}
                          </span>
                          <span className="font-medium text-foreground">
                            Subscription payment
                          </span>
                          {txn.environment === "sandbox" && (
                            <Badge variant="outline" className="text-[10px] uppercase">
                              test
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(txn.billed_at).toLocaleString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          {formatMoney(txn.amount_cents, txn.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase">
                          {txn.currency}
                        </p>
                      </div>
                      <Badge
                        variant={cfg.variant}
                        className="gap-1 text-xs min-w-[80px] justify-center capitalize"
                      >
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
