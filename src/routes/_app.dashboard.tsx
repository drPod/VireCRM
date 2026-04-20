import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  Users,
  Send,
  MessageSquare,
  TrendingUp,
  Target,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandBar } from "@/components/crm/CommandBar";
import { MetricCard } from "@/components/crm/MetricCard";
import { ActivityFeed } from "@/components/crm/ActivityFeed";
import { PipelineView } from "@/components/crm/PipelineView";
import { executeCommandFn, type CommandPlan } from "@/functions/command.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

function DashboardErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Couldn't load your dashboard</p>
            <p className="text-xs text-muted-foreground mt-1">
              {error?.message || "Something went wrong."}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="command"
            size="sm"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  errorComponent: DashboardErrorComponent,
  head: () => ({
    meta: [
      { title: "Dashboard — Genesis" },
      { name: "description", content: "Your AI-powered command center for sales pipeline, leads, and campaigns." },
    ],
  }),
});

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function Dashboard() {
  const { organization, profile } = useAuth();
  const metrics = useDashboardMetrics(organization?.id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [plan, setPlan] = useState<CommandPlan | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const execCommand = useServerFn(executeCommandFn);

  const handleCommand = async (command: string) => {
    setIsProcessing(true);
    setLastCommand(command);
    setPlan(null);

    try {
      const result = await execCommand({ data: { command } });
      setPlan(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Command failed";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isEmpty = !metrics.loading && metrics.totalLeads === 0;
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {firstName ? `Welcome back, ${firstName}` : "Command Center"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Type a command, or jump into your pipeline below.
          </p>
        </div>
      </div>

      <CommandBar onCommand={handleCommand} isProcessing={isProcessing} />

      {lastCommand && isProcessing && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <Zap className="h-4 w-4 animate-pulse text-primary" />
          <span className="text-sm text-foreground">
            AI is planning: <span className="font-medium text-primary">{lastCommand}</span>
          </span>
        </div>
      )}

      {plan && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-primary/5 px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-semibold text-foreground">Execution Plan</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {plan.estimatedTotal}
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
          </div>

          <div className="divide-y divide-border">
            {plan.steps.map((step) => (
              <div key={step.step} className="flex items-start gap-3 px-5 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {step.step}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{step.action}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{step.estimatedTime}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {plan.warnings.length > 0 && (
            <div className="border-t border-border bg-warning/5 px-5 py-3">
              {plan.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-warning" />
                  <span className="text-xs text-warning">{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* First-run empty state */}
      {isEmpty && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">Get your first leads in</h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-lg">
                Genesis needs leads before it can score, message, and convert. Add your first
                lead manually, import a CSV, or let our AI scout build a list for you.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/leads" search={{ action: "add" }}>
                  <Button variant="command" size="sm" className="gap-1.5">
                    Add a lead
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link to="/leads" search={{ action: "import" }}>
                  <Button variant="outline" size="sm">Import CSV</Button>
                </Link>
                <Link to="/advisor">
                  <Button variant="outline" size="sm">Let AI find leads</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total Leads"
          value={metrics.loading ? "—" : formatNumber(metrics.totalLeads)}
          change={metrics.newLeads30d > 0 ? `+${metrics.newLeads30d} this month` : undefined}
          changeType="positive"
        />
        <MetricCard
          icon={Send}
          label="Outreach Sent"
          value={metrics.loading ? "—" : formatNumber(metrics.outreachSent)}
        />
        <MetricCard
          icon={MessageSquare}
          label="Replies"
          value={metrics.loading ? "—" : formatNumber(metrics.replies)}
        />
        <MetricCard
          icon={TrendingUp}
          label="Conversion"
          value={metrics.loading ? "—" : `${metrics.conversionRate.toFixed(1)}%`}
        />
      </div>

      <div>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Pipeline</h2>
        </div>
        <PipelineView />
      </div>

      <ActivityFeed />
    </div>
  );
}
