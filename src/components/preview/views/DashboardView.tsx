import { Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const metrics = [
  { label: "Active Leads", value: "1,284", change: "+12.5%", trend: "up" as const, icon: Users },
  { label: "Pipeline Value", value: "$347,920", change: "+8.2%", trend: "up" as const, icon: TrendingUp },
  { label: "Closed This Month", value: "47", change: "+23%", trend: "up" as const, icon: CheckCircle2 },
  { label: "Avg Response Time", value: "2.4 min", change: "-41%", trend: "down" as const, icon: Clock },
];

const pipelineStages = [
  { name: "New", count: 142, color: "oklch(0.65 0.15 250)" },
  { name: "Contacted", count: 87, color: "oklch(0.65 0.18 280)" },
  { name: "Qualified", count: 54, color: "oklch(0.65 0.18 320)" },
  { name: "Proposal", count: 28, color: "oklch(0.7 0.18 50)" },
  { name: "Won", count: 18, color: "oklch(0.7 0.18 145)" },
];

const sampleLeads = [
  { name: "Sarah Chen", company: "Apex Logistics", status: "Qualified", value: "$24,500", score: 92, initials: "SC" },
  { name: "Marcus Webb", company: "Northwind Energy", status: "Proposal", value: "$58,000", score: 88, initials: "MW" },
  { name: "Priya Patel", company: "BlueRiver Tech", status: "Contacted", value: "$12,300", score: 76, initials: "PP" },
  { name: "David Okafor", company: "Helix Manufacturing", status: "Qualified", value: "$41,200", score: 84, initials: "DO" },
  { name: "Emma Lindqvist", company: "Polaris Retail Group", status: "New", value: "$8,900", score: 68, initials: "EL" },
];

const activityFeed = [
  { icon: Mail, text: "AI sent follow-up to Sarah Chen", time: "2m ago", color: "text-primary" },
  { icon: Phone, text: "Marcus Webb booked a discovery call", time: "18m ago", color: "text-success" },
  { icon: CheckCircle2, text: "Deal closed: Helix Manufacturing — $41,200", time: "1h ago", color: "text-success" },
  { icon: Sparkles, text: "AI Advisor identified 12 hot leads", time: "3h ago", color: "text-primary" },
  { icon: MessageSquare, text: "New reply from Priya Patel", time: "5h ago", color: "text-foreground" },
];

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Won" || status === "Qualified") return "default";
  if (status === "Proposal") return "secondary";
  return "outline";
}

export function DashboardView() {
  return (
    <>
      <div data-tour="metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 scroll-mt-24">
        {metrics.map((m) => (
          <Card key={m.label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{m.value}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <m.icon className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`mt-3 flex items-center gap-1 text-xs font-medium ${
                m.trend === "up" ? "text-success" : "text-destructive"
              }`}
            >
              {m.trend === "up" ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {m.change} <span className="text-muted-foreground">vs last month</span>
            </div>
          </Card>
        ))}
      </div>

      <Card data-tour="pipeline" className="p-5 scroll-mt-24">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Pipeline</h3>
            <p className="text-sm text-muted-foreground">329 active opportunities</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> AI prioritized
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {pipelineStages.map((s) => (
            <div
              key={s.name}
              className="rounded-lg border border-border bg-card/50 p-3"
              style={{ borderTopWidth: 3, borderTopColor: s.color }}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {s.name}
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{s.count}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Hot leads</h3>
            <span className="text-xs text-muted-foreground">Top 5 by AI score</span>
          </div>
          <div className="space-y-2">
            {sampleLeads.map((lead) => (
              <div
                key={lead.name}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3 transition-colors duration-150 hover:bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-[oklch(0.65_0.16_320)]/30 text-xs font-semibold text-foreground">
                    {lead.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <Badge variant={statusBadgeVariant(lead.status)} className="text-[10px]">
                    {lead.status}
                  </Badge>
                  <span className="hidden text-sm font-medium text-foreground sm:inline">
                    {lead.value}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-sm font-semibold text-primary">{lead.score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-foreground">Live activity</h3>
          <div className="space-y-3">
            {activityFeed.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-md bg-card p-1.5 ${a.color}`}>
                  <a.icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{a.text}</p>
                  <p className="text-xs text-muted-foreground">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-[oklch(0.65_0.16_320)]/10 p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Ready to plug in your real pipeline?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start your free trial and let Majix chase every lead for you, 24/7.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="lg" data-preview-allow="true">
              <Link to="/pricing" data-preview-allow="true">
                See pricing
              </Link>
            </Button>
            <Button asChild variant="command" size="lg" className="gap-2" data-preview-allow="true">
              <Link to="/signup" data-preview-allow="true">
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
