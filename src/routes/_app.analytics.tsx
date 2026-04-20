import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Users, Clock, Loader2 } from "lucide-react";
import { MetricCard } from "@/components/crm/MetricCard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "Genesis — Analytics" },
      { name: "description", content: "Sales analytics and performance metrics" },
    ],
  }),
});

function StatRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-4">
      <span className="w-24 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-secondary">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="w-12 text-right text-xs font-medium text-foreground">{value}</span>
      <span className="w-10 text-right text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

interface PipelineCounts {
  new: number;
  contacted: number;
  qualified: number;
  negotiation: number;
  won: number;
  lost: number;
}

interface Analytics {
  newLeads30d: number;
  newLeadsPrev30d: number;
  totalLeads: number;
  pipeline: PipelineCounts;
  weeklyTrend: { weekStart: Date; sent: number }[];
  totalSent: number;
  totalReplies: number;
}

function pctChange(curr: number, prev: number): { label: string; positive: boolean } | null {
  if (prev === 0) {
    return curr > 0 ? { label: "+100%", positive: true } : null;
  }
  const change = ((curr - prev) / prev) * 100;
  const rounded = Math.round(change * 10) / 10;
  return { label: `${rounded >= 0 ? "+" : ""}${rounded}%`, positive: rounded >= 0 };
}

function AnalyticsPage() {
  const { organization } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const orgId = organization.id;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

      const [leadsRes, recentLeadsRes, prevLeadsRes, messagesRes] = await Promise.all([
        supabase
          .from("leads")
          .select("status", { count: "exact" })
          .eq("organization_id", orgId)
          .limit(5000),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .gte("created_at", thirtyDaysAgo.toISOString()),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .gte("created_at", sixtyDaysAgo.toISOString())
          .lt("created_at", thirtyDaysAgo.toISOString()),
        supabase
          .from("messages")
          .select("status, created_at")
          .eq("organization_id", orgId)
          .gte("created_at", twelveWeeksAgo.toISOString())
          .limit(5000),
      ]);

      if (cancelled) return;

      const pipeline: PipelineCounts = {
        new: 0,
        contacted: 0,
        qualified: 0,
        negotiation: 0,
        won: 0,
        lost: 0,
      };
      for (const row of leadsRes.data ?? []) {
        const s = row.status as keyof PipelineCounts;
        if (s in pipeline) pipeline[s] += 1;
      }

      // 12-week buckets, oldest first
      const weeks: { weekStart: Date; sent: number }[] = Array.from({ length: 12 }, (_, i) => {
        const start = new Date(twelveWeeksAgo.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        return { weekStart: start, sent: 0 };
      });
      let totalSent = 0;
      let totalReplies = 0;
      for (const m of messagesRes.data ?? []) {
        const t = new Date(m.created_at).getTime();
        const idx = Math.floor((t - twelveWeeksAgo.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (idx >= 0 && idx < 12 && m.status !== "draft") {
          weeks[idx].sent += 1;
          totalSent += 1;
        }
        if (m.status === "replied") totalReplies += 1;
      }

      setData({
        newLeads30d: recentLeadsRes.count ?? 0,
        newLeadsPrev30d: prevLeadsRes.count ?? 0,
        totalLeads: leadsRes.count ?? 0,
        pipeline,
        weeklyTrend: weeks,
        totalSent,
        totalReplies,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  if (loading || !data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalPipeline =
    data.pipeline.new +
    data.pipeline.contacted +
    data.pipeline.qualified +
    data.pipeline.negotiation +
    data.pipeline.won +
    data.pipeline.lost;

  const winRate =
    totalPipeline > 0 ? Math.round((data.pipeline.won / totalPipeline) * 1000) / 10 : 0;
  const replyRate =
    data.totalSent > 0 ? Math.round((data.totalReplies / data.totalSent) * 1000) / 10 : 0;

  const newLeadsChange = pctChange(data.newLeads30d, data.newLeadsPrev30d);
  const maxWeek = Math.max(1, ...data.weeklyTrend.map((w) => w.sent));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Performance overview and insights</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={Users}
          label="New Leads (30d)"
          value={String(data.newLeads30d)}
          change={newLeadsChange?.label}
          changeType={newLeadsChange?.positive ? "positive" : "negative"}
        />
        <MetricCard
          icon={TrendingUp}
          label="Win Rate"
          value={`${winRate}%`}
        />
        <MetricCard
          icon={Clock}
          label="Reply Rate"
          value={`${replyRate}%`}
        />
        <MetricCard
          icon={BarChart3}
          label="Total Leads"
          value={String(data.totalLeads)}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Pipeline Breakdown</h3>
          {totalPipeline === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No leads yet. Add leads to see your pipeline distribution.
            </p>
          ) : (
            <div className="space-y-3">
              <StatRow label="New" value={data.pipeline.new} total={totalPipeline} color="bg-info" />
              <StatRow label="Contacted" value={data.pipeline.contacted} total={totalPipeline} color="bg-primary" />
              <StatRow label="Qualified" value={data.pipeline.qualified} total={totalPipeline} color="bg-warning" />
              <StatRow label="Negotiation" value={data.pipeline.negotiation} total={totalPipeline} color="bg-chart-5" />
              <StatRow label="Won" value={data.pipeline.won} total={totalPipeline} color="bg-success" />
              <StatRow label="Lost" value={data.pipeline.lost} total={totalPipeline} color="bg-destructive" />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Outreach Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Messages Sent</p>
                <p className="text-xs text-muted-foreground">Last 12 weeks</p>
              </div>
              <span className="text-sm font-semibold text-foreground">{data.totalSent}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Replies Received</p>
                <p className="text-xs text-muted-foreground">Last 12 weeks</p>
              </div>
              <span className="text-sm font-semibold text-foreground">{data.totalReplies}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Reply Rate</p>
                <p className="text-xs text-muted-foreground">Replies ÷ sent</p>
              </div>
              <span className="text-sm font-semibold text-foreground">{replyRate}%</span>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Weekly Outreach Trend</h3>
        {data.totalSent === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No outreach yet. Send messages to see your weekly trend.
          </p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {data.weeklyTrend.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                  style={{ height: `${(w.sent / maxWeek) * 100}%` }}
                  title={`${w.sent} sent`}
                />
                {i % 3 === 0 && (
                  <span className="text-[9px] text-muted-foreground">W{Math.floor(i / 3) + 1}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
