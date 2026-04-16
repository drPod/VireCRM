import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Users, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { MetricCard } from "@/components/crm/MetricCard";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "Vireon — Analytics" },
      { name: "description", content: "Sales analytics and performance metrics" },
    ],
  }),
});

function StatRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-4">
      <span className="w-24 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1"><div className="h-2 rounded-full bg-secondary"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div></div>
      <span className="w-12 text-right text-xs font-medium text-foreground">{value}</span>
      <span className="w-10 text-right text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Analytics</h1><p className="text-sm text-muted-foreground">Performance overview and insights</p></div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={Users} label="New Leads (30d)" value="487" change="+18%" changeType="positive" />
        <MetricCard icon={TrendingUp} label="Win Rate" value="14.2%" change="+2.1%" changeType="positive" />
        <MetricCard icon={Clock} label="Avg Response Time" value="2.4h" change="-15%" changeType="positive" />
        <MetricCard icon={BarChart3} label="Revenue Pipeline" value="$284K" change="+22%" changeType="positive" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Pipeline Breakdown</h3>
          <div className="space-y-3">
            <StatRow label="New" value={312} total={1284} color="bg-info" />
            <StatRow label="Contacted" value={428} total={1284} color="bg-primary" />
            <StatRow label="Qualified" value={267} total={1284} color="bg-warning" />
            <StatRow label="Negotiation" value={156} total={1284} color="bg-chart-5" />
            <StatRow label="Won" value={121} total={1284} color="bg-success" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">AI Agent Performance</h3>
          <div className="space-y-4">
            {[
              { agent: "Lead Scoring", tasks: 2847, accuracy: 94.2, trend: "up" },
              { agent: "Reply Classification", tasks: 1233, accuracy: 91.8, trend: "up" },
              { agent: "Message Generation", tasks: 3891, accuracy: 88.5, trend: "down" },
              { agent: "Auto Scheduling", tasks: 342, accuracy: 96.1, trend: "up" },
            ].map((item) => (
              <div key={item.agent} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.agent}</p>
                  <p className="text-xs text-muted-foreground">{item.tasks.toLocaleString()} tasks</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground">{item.accuracy}%</span>
                  {item.trend === "up" ? <ArrowUpRight className="h-3.5 w-3.5 text-success" /> : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Weekly Outreach Trend</h3>
        <div className="flex items-end gap-2 h-32">
          {[45, 62, 78, 55, 89, 72, 95, 68, 110, 88, 124, 102].map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary" style={{ height: `${(val / 124) * 100}%` }} />
              {i % 3 === 0 && <span className="text-[9px] text-muted-foreground">W{Math.floor(i / 3) + 1}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
