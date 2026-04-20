import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  Loader2,
  MessageSquare,
  Send,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/_app/campaigns/analytics")({
  component: CampaignsAnalyticsPage,
  head: () => ({
    meta: [
      { title: "Genesis — Campaigns Analytics" },
      {
        name: "description",
        content: "Send, open, and reply analytics for your outreach campaigns",
      },
    ],
  }),
});

type CampaignStatus = "active" | "paused" | "completed" | "draft";

interface CampaignRow {
  id: string;
  name: string;
  status: CampaignStatus;
  leads_count: number;
  sent_count: number;
  opens_count: number; // derived from messages with status >= opened
  replies_count: number;
}

interface MessageAggRow {
  organization_id: string;
  status: string;
}

const STATUS_COLORS: Record<CampaignStatus, string> = {
  active: "oklch(0.7 0.18 145)",
  paused: "oklch(0.78 0.15 75)",
  completed: "oklch(0.6 0.02 260)",
  draft: "oklch(0.65 0.18 250)",
};

const statusVariants: Record<
  CampaignStatus,
  "success" | "warning" | "secondary" | "info"
> = {
  active: "success",
  paused: "warning",
  completed: "secondary",
  draft: "info",
};

function isCampaignStatus(s: string): s is CampaignStatus {
  return s === "active" || s === "paused" || s === "completed" || s === "draft";
}

function pct(n: number, d: number): string {
  if (d <= 0) return "0%";
  return ((n / d) * 100).toFixed(1) + "%";
}

function CampaignsAnalyticsPage() {
  const { organization } = useAuth();
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [orgOpenCount, setOrgOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [campaignsRes, openMsgRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select(
            "id, name, status, leads_count, sent_count, replies_count",
          )
          .eq("organization_id", organization.id)
          .order("sent_count", { ascending: false })
          .limit(100),
        // Org-wide opens: messages where the recipient engaged.
        // We count "opened" + "replied" as evidence of an open.
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization.id)
          .in("status", ["opened", "replied"]),
      ]);
      if (cancelled) return;

      const campaigns = campaignsRes.data ?? [];
      // We don't currently link messages -> campaigns, so derive a per-campaign
      // open estimate by scaling the org-wide open rate against each campaign's sent_count.
      const totalSent = campaigns.reduce(
        (acc, c) => acc + (c.sent_count ?? 0),
        0,
      );
      const totalOpens = openMsgRes.count ?? 0;
      const openRate = totalSent > 0 ? Math.min(totalOpens / totalSent, 1) : 0;

      setOrgOpenCount(totalOpens);
      setRows(
        campaigns.map((c) => {
          const sent = c.sent_count ?? 0;
          return {
            id: c.id,
            name: c.name,
            status: isCampaignStatus(c.status) ? c.status : "draft",
            leads_count: c.leads_count ?? 0,
            sent_count: sent,
            opens_count: Math.round(sent * openRate),
            replies_count: c.replies_count ?? 0,
          };
        }),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  const totals = useMemo(() => {
    const t = rows.reduce(
      (acc, r) => {
        acc.leads += r.leads_count;
        acc.sent += r.sent_count;
        acc.replies += r.replies_count;
        return acc;
      },
      { leads: 0, sent: 0, replies: 0 },
    );
    return { ...t, opens: orgOpenCount };
  }, [rows, orgOpenCount]);

  const chartData = useMemo(
    () =>
      rows
        .slice(0, 10)
        .map((r) => ({
          name: r.name.length > 18 ? r.name.slice(0, 16) + "…" : r.name,
          Sent: r.sent_count,
          Opens: r.opens_count,
          Replies: r.replies_count,
        })),
    [rows],
  );

  const statusBreakdown = useMemo(() => {
    const map = new Map<CampaignStatus, number>();
    for (const r of rows) map.set(r.status, (map.get(r.status) ?? 0) + 1);
    return Array.from(map.entries()).map(([status, value]) => ({
      status,
      value,
    }));
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/campaigns"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to campaigns
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            Campaigns Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Performance breakdown across all outreach campaigns
          </p>
        </div>
        <Button asChild variant="command" size="sm">
          <Link to="/campaigns" search={{ new: true }}>
            <Zap className="h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            No campaign data yet
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a campaign and start sending to see analytics here.
          </p>
          <Button asChild variant="command" size="sm" className="mt-4">
            <Link to="/campaigns" search={{ new: true }}>
              <Zap className="h-4 w-4" />
              New Campaign
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              icon={Users}
              label="Leads enrolled"
              value={totals.leads.toLocaleString()}
              sub={`${rows.length} campaign${rows.length === 1 ? "" : "s"}`}
            />
            <KpiCard
              icon={Send}
              label="Emails sent"
              value={totals.sent.toLocaleString()}
              sub={`${pct(totals.sent, totals.leads)} of leads`}
            />
            <KpiCard
              icon={Eye}
              label="Opens"
              value={totals.opens.toLocaleString()}
              sub={`${pct(totals.opens, totals.sent)} open rate`}
            />
            <KpiCard
              icon={MessageSquare}
              label="Replies"
              value={totals.replies.toLocaleString()}
              sub={`${pct(totals.replies, totals.sent)} reply rate`}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Top campaigns — Sent vs Opens vs Replies
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  Top 10 by send volume
                </span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.4 0.02 260 / 0.2)"
                    />
                    <XAxis
                      dataKey="name"
                      stroke="oklch(0.65 0.02 260)"
                      fontSize={11}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="oklch(0.65 0.02 260)"
                      fontSize={11}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      cursor={{ fill: "oklch(0.65 0.2 250 / 0.08)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="Sent"
                      fill="oklch(0.65 0.18 250)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="Opens"
                      fill="oklch(0.7 0.16 200)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="Replies"
                      fill="oklch(0.7 0.18 145)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                Campaigns by status
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="value"
                      nameKey="status"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {statusBreakdown.map((entry) => (
                        <Cell
                          key={entry.status}
                          fill={STATUS_COLORS[entry.status]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        textTransform: "capitalize",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: 11,
                        textTransform: "capitalize",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Per-campaign breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Opens</TableHead>
                    <TableHead className="text-right">Replies</TableHead>
                    <TableHead className="text-right">Reply rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={statusVariants[r.status]}
                          className="capitalize"
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.leads_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.sent_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.opens_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.replies_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(r.replies_count, r.sent_count)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Note: Open counts are estimated from org-wide message engagement
            because per-campaign opens aren&apos;t individually tracked yet.
            Replies and sent counts come straight from the campaign record.
          </p>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
// MessageAggRow type kept for future per-campaign open attribution
export type { MessageAggRow };
