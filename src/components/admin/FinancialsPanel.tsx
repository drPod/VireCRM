import { useEffect, useState } from "react";
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
import {
  Loader2,
  RefreshCw,
  Building2,
  Users,
  FileText,
  ExternalLink,
  DollarSign,
  TrendingUp,
  Activity,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { formatMoney } from "@/lib/money";
import { planBadgeVariant, subStatusVariant } from "@/lib/admin-utils";
import type { FinancialOverview } from "@/types/admin";

// Local helper — accept "USD" / "usd" / etc. Existing RPC payload uses lowercase.
function fmt(cents: number, currency = "usd"): string {
  return formatMoney(cents, currency.toUpperCase());
}

// Local invoice-status variant. Slightly broader than `subStatusVariant`
// (covers `open`, `void`, `uncollectible`, etc.). Kept inline because
// only this panel and the Stripe-invoice panel need it; the latter
// re-declares its own copy alongside the rest of the submission flow.
function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") return "default";
  if (status === "void" || status === "uncollectible") return "destructive";
  if (status === "open" || status === "sent" || status === "finalized") return "secondary";
  return "outline";
}

// Inline StatCard used by FinancialsPanel only. Unit 6 owns a shared
// `src/components/admin/StatCard.tsx` (richer than `QuotesPanel`'s
// minimal variant) and will dedup this at rebase. Until then, keeping
// the exact original implementation inline preserves visual parity.
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "muted";
}) {
  const accentClass =
    accent === "success"
      ? "text-emerald-400"
      : accent === "warning"
        ? "text-amber-400"
        : accent === "muted"
          ? "text-muted-foreground"
          : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${accentClass}`} />
        </div>
        <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function FinancialsPanel() {
  const [data, setData] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.rpc("admin_financial_overview");
    if (err) {
      setError(err.message);
      toast.error("Failed to load financial overview", { description: err.message });
    } else {
      setData(res as unknown as FinancialOverview);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // realtime updates
    const channel = supabase
      .channel("admin-financials")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () =>
        load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_invoices" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={load} variant="outline" size="sm" className="mt-3 gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { subscriptions: s, invoices: inv, organizations: orgs, users: usr } = data;
  const planEntries = Object.entries(data.plan_breakdown || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Financial overview</h2>
          <p className="text-xs text-muted-foreground">
            Live snapshot · updated{" "}
            {formatDistanceToNow(new Date(data.generated_at), { addSuffix: true })}
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" className="gap-2" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Revenue row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Revenue (this month)"
          value={fmt(inv.paid_cents_this_month)}
          hint={`${inv.new_this_month} new invoice${inv.new_this_month === 1 ? "" : "s"}`}
          accent="success"
        />
        <StatCard
          icon={TrendingUp}
          label="Revenue (all time)"
          value={fmt(inv.paid_cents_total)}
          hint={`${inv.paid_count} paid invoice${inv.paid_count === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={Receipt}
          label="Outstanding"
          value={fmt(inv.outstanding_cents)}
          hint={`${inv.outstanding_count} unpaid`}
          accent="warning"
        />
        <StatCard
          icon={FileText}
          label="Total invoices"
          value={String(inv.total)}
          hint={`${inv.void_count} voided`}
          accent="muted"
        />
      </div>

      {/* Subscribers + customers row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Active subscribers"
          value={String(s.active)}
          hint={`${s.trialing} trialing · ${s.past_due} past due`}
          accent="success"
        />
        <StatCard
          icon={TrendingUp}
          label="New subscribers (this month)"
          value={String(s.new_this_month)}
          hint={s.ending_soon > 0 ? `${s.ending_soon} ending soon` : "No cancellations queued"}
        />
        <StatCard
          icon={Users}
          label="Active users"
          value={String(usr.total)}
          hint={`+${usr.new_this_month} this month`}
        />
        <StatCard
          icon={Building2}
          label="Customer orgs"
          value={String(orgs.total)}
          hint={`${orgs.paying} paying`}
        />
      </div>

      {/* Plan breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {planEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {planEntries.map(([plan, count]) => (
                <Badge key={plan} variant={planBadgeVariant(plan)} className="gap-1">
                  {plan}
                  <span className="opacity-70">· {count}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recent_invoices.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Stripe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_invoices.map((iv) => (
                  <TableRow key={iv.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {iv.customer_name || iv.customer_email}
                      </div>
                      <div className="text-xs text-muted-foreground">{iv.customer_email}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {iv.number || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {fmt(iv.amount_due_cents, iv.currency)}
                      </div>
                      {iv.amount_paid_cents > 0 && iv.amount_paid_cents !== iv.amount_due_cents && (
                        <div className="text-xs text-emerald-400">
                          paid {fmt(iv.amount_paid_cents, iv.currency)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(iv.status)}>{iv.status}</Badge>
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
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent subscribers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent subscribers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recent_subscriptions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No subscriptions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Plan / Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Renews</TableHead>
                  <TableHead>Env</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium text-foreground">
                      {sub.email || sub.user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{sub.price_id}</TableCell>
                    <TableCell>
                      <Badge variant={subStatusVariant(sub.status)}>{sub.status}</Badge>
                      {sub.cancel_at_period_end && (
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          cancels
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sub.current_period_end
                        ? formatDistanceToNow(new Date(sub.current_period_end), { addSuffix: true })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {sub.environment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
