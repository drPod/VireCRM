import { createFileRoute, Link } from "@tanstack/react-router";
import {
  TrendingUp,
  DollarSign,
  Wallet,
  Receipt,
  Users,
  Percent,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import { RouteError } from "@/components/RouteError";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRevenueMetrics } from "@/hooks/useRevenueMetrics";
import { formatMoney, formatCompactMoney } from "@/lib/money";

export const Route = createFileRoute("/_app/revenue")({
  component: RevenuePage,
  errorComponent: (props) => <RouteError {...props} label="Couldn't load revenue data" />,
  head: () => ({
    meta: [
      { title: "Revenue & Finance — Majix" },
      {
        name: "description",
        content: "Track MRR, ARR, profit & loss, and team commission payouts across your CRM.",
      },
    ],
  }),
});

function RevenuePage() {
  const { organization } = useAuth();
  const m = useRevenueMetrics(organization?.id);

  const profitable = m.netProfitCents >= 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revenue & Finance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            MRR, profit & loss, and where your money is flowing — last 12 months.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/payouts">
              <Wallet className="mr-1.5 h-3.5 w-3.5" />
              Team Payouts
            </Link>
          </Button>
          <Button variant="command" size="sm" asChild>
            <Link to="/expenses">
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
              Log Expense
            </Link>
          </Button>
        </div>
      </div>

      {/* Headline KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="MRR"
          value={formatCompactMoney(m.mrrCents)}
          sub="This month closed deals"
          icon={TrendingUp}
          loading={m.loading}
          accent="primary"
        />
        <KpiCard
          label="ARR"
          value={formatCompactMoney(m.arrCents)}
          sub="MRR × 12"
          icon={DollarSign}
          loading={m.loading}
          accent="primary"
        />
        <KpiCard
          label="Net Profit (12mo)"
          value={formatCompactMoney(m.netProfitCents)}
          sub={profitable ? "Profitable" : "In the red"}
          icon={profitable ? ArrowUpRight : ArrowDownRight}
          loading={m.loading}
          accent={profitable ? "success" : "destructive"}
        />
        <KpiCard
          label="Avg Deal Value"
          value={formatCompactMoney(m.arpuCents)}
          sub={`${m.closedDealCount} closed`}
          icon={Target}
          loading={m.loading}
          accent="primary"
        />
      </div>

      {/* Revenue trend chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Revenue trend</h2>
            <p className="text-xs text-muted-foreground">Closed deal value, monthly</p>
          </div>
          <span className="text-xs font-semibold text-primary">
            {formatMoney(m.totalRevenueCents)} total
          </span>
        </div>
        <div className="h-64 w-full">
          {m.loading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.monthly}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.65 0.2 290)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.65 0.2 290)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompactMoney(v as number)}
                />
                <Tooltip content={<MoneyTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="oklch(0.7 0.2 290)"
                  strokeWidth={2}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* P&L breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Profit & Loss</h2>
              <p className="text-xs text-muted-foreground">Revenue vs costs, monthly</p>
            </div>
          </div>
          <div className="h-64 w-full">
            {m.loading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.monthly}>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCompactMoney(v as number)}
                  />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="oklch(0.7 0.18 160)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Expenses"
                    fill="oklch(0.7 0.18 30)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="payouts"
                    name="Payouts"
                    fill="oklch(0.7 0.18 290)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* P&L summary */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-base font-semibold text-foreground mb-2">12-month summary</h2>
          <PlRow label="Revenue" value={m.totalRevenueCents} positive />
          <PlRow label="Expenses" value={-m.totalExpensesCents} />
          <PlRow label="Team payouts" value={-m.totalPayoutsCents} />
          <div className="border-t border-border pt-3">
            <PlRow
              label="Net Profit"
              value={m.netProfitCents}
              bold
              positive={m.netProfitCents >= 0}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border text-xs">
            <SmallStat label="Win rate" value={`${Math.round(m.wonRate * 100)}%`} icon={Percent} />
            <SmallStat label="Closed deals" value={String(m.closedDealCount)} icon={Users} />
          </div>
        </div>
      </div>

      {/* Empty state nudge */}
      {!m.loading && m.totalRevenueCents === 0 && m.totalExpensesCents === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary/50 mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No revenue tracked yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Add a deal value to your leads and mark them as <span className="font-medium">won</span>{" "}
            to start tracking revenue. Or log an expense to track your business costs.
          </p>
          <div className="flex gap-2 justify-center mt-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/leads">
                Go to Leads
              </Link>
            </Button>
            <Button variant="command" size="sm" asChild>
              <Link to="/expenses">
                Log first expense
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof TrendingUp;
  loading: boolean;
  accent: "primary" | "success" | "destructive";
}) {
  const accentClass =
    accent === "success"
      ? "bg-success/10 text-success"
      : accent === "destructive"
        ? "bg-destructive/10 text-destructive"
        : "bg-primary/10 text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-7 w-24 rounded bg-muted animate-pulse" />
        ) : (
          <span className="text-2xl font-bold text-foreground">{value}</span>
        )}
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </div>
    </div>
  );
}

function PlRow({
  label,
  value,
  positive,
  bold,
}: {
  label: string;
  value: number;
  positive?: boolean;
  bold?: boolean;
}) {
  const color =
    positive === undefined
      ? "text-foreground"
      : positive
        ? "text-success"
        : value < 0
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-sm ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <span className={`text-sm tabular-nums ${bold ? "font-bold" : "font-medium"} ${color}`}>
        {value < 0 ? "-" : ""}
        {formatMoney(Math.abs(value))}
      </span>
    </div>
  );
}

function SmallStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-full w-full rounded-lg bg-muted/30 animate-pulse" />;
}

function MoneyTooltip(props: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!props.active || !props.payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-2.5 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-1">{props.label}</p>
      {props.payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground tabular-nums">{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
