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
  Play,
  CheckCheck,
  XCircle,
  ListTodo,
  Mail,
  TrendingDown,
  Megaphone,
  StickyNote,
  BarChart3,
  ArrowRightLeft,
  CalendarClock,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandBar } from "@/components/crm/CommandBar";
import { MetricCard } from "@/components/crm/MetricCard";
import { ActivityFeed } from "@/components/crm/ActivityFeed";
import { PipelineView } from "@/components/crm/PipelineView";
import { WonDealsWidget } from "@/components/crm/WonDealsWidget";
import { CreditUsageWidget } from "@/components/crm/CreditUsageWidget";
import { TaskStatusPanel, type TaskStatusItem } from "@/components/crm/TaskStatusPanel";
import { AdvisorAuditLog } from "@/components/crm/AdvisorAuditLog";
import { executeCommandFn, type CommandPlan } from "@/functions/command.functions";
import {
  executeCommandActionsFn,
  type ExecuteCommandResponse,
  type ExecutionResult,
} from "@/functions/command-execute.functions";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

// Client-side guard so a hung tool call still surfaces to the user instead of
// spinning forever. Server-side timeouts may still be longer; this is the UX
// floor.
const COMMAND_TIMEOUT_MS = 45_000;

type CommandErrorKind = "credits" | "rate_limit" | "timeout" | "network" | "auth" | "api";

function classifyCommandError(err: unknown): {
  kind: CommandErrorKind;
  title: string;
  message: string;
} {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
  const lower = raw.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return {
      kind: "timeout",
      title: "Command timed out",
      message: "The AI took too long to respond. Try again or simplify the command.",
    };
  }
  if (
    lower.includes("credit") ||
    lower.includes("402") ||
    lower.includes("exhausted") ||
    lower.includes("insufficient")
  ) {
    return {
      kind: "credits",
      title: "Out of credits",
      message: "Top up your workspace credits to keep running commands.",
    };
  }
  if (lower.includes("429") || lower.includes("rate")) {
    return {
      kind: "rate_limit",
      title: "Rate limited",
      message: "AI is rate-limited. Wait a few seconds and retry.",
    };
  }
  if (
    lower.includes("401") ||
    lower.includes("unauthor") ||
    lower.includes("forbidden") ||
    lower.includes("403")
  ) {
    return { kind: "auth", title: "Not authorized", message: raw };
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) {
    return { kind: "network", title: "Network error", message: "Check your connection and retry." };
  }
  return { kind: "api", title: "Command failed", message: raw };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

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
      {
        name: "description",
        content: "Your AI-powered command center for sales pipeline, leads, and campaigns.",
      },
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
  const [isExecuting, setIsExecuting] = useState(false);
  const [execution, setExecution] = useState<ExecuteCommandResponse | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<TaskStatusItem[]>([]);
  const execCommand = useAuthedServerFn(executeCommandFn);
  const runCommand = useAuthedServerFn(executeCommandActionsFn);
  const router = useRouter();

  const handleCommand = async (command: string) => {
    setIsProcessing(true);
    setLastCommand(command);
    setPlan(null);
    setExecution(null);
    setTaskStatuses([]);

    try {
      const result = await withTimeout(
        execCommand({ data: { command } }),
        COMMAND_TIMEOUT_MS,
        "Planning",
      );
      setPlan(result);
      // Seed the status panel with planned steps as soon as the AI responds.
      setTaskStatuses(
        result.steps.map((s) => ({
          step: s.step,
          action: s.action,
          detail: s.detail,
          status: "planned" as const,
        })),
      );
    } catch (err: unknown) {
      const info = classifyCommandError(err);
      const isCredits = info.kind === "credits";
      toast.error(info.title, {
        description: info.message,
        duration: 8000,
        action: isCredits
          ? {
              label: "Top up",
              onClick: () =>
                router.navigate({
                  to: "/billing",
                  search: { required: undefined, plan: undefined } as never,
                }),
            }
          : { label: "Retry", onClick: () => void handleCommand(command) },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async () => {
    if (!lastCommand || isExecuting || !plan) return;
    setIsExecuting(true);
    setExecution(null);

    // Mark every planned step as queued, then animate "running" one at a time.
    setTaskStatuses((prev) =>
      prev.map((s) => ({ ...s, status: "queued" as const, message: undefined })),
    );

    const totalSteps = plan.steps.length;
    let runningIndex = 0;
    const runningTimer = setInterval(
      () => {
        setTaskStatuses((prev) => {
          if (runningIndex >= prev.length) return prev;
          const next = prev.map((s, i) => {
            if (i < runningIndex) return s;
            if (i === runningIndex) return { ...s, status: "running" as const };
            return s;
          });
          runningIndex += 1;
          return next;
        });
      },
      Math.max(400, Math.min(1200, Math.floor(2400 / Math.max(1, totalSteps)))),
    );

    try {
      const result = await withTimeout(
        runCommand({ data: { command: lastCommand } }),
        COMMAND_TIMEOUT_MS,
        "Execution",
      );
      setExecution(result);

      // Map server results back onto the planned steps positionally.
      setTaskStatuses((prev) =>
        prev.map((s, i) => {
          const r = result.results[i];
          if (!r) {
            return { ...s, status: "completed" as const };
          }
          const status: TaskStatusItem["status"] =
            r.status === "ok" ? "completed" : r.status === "error" ? "failed" : "skipped";
          return {
            ...s,
            status,
            handler: r.handler,
            message: r.message,
          };
        }),
      );

      const okCount = result.results.filter((r) => r.status === "ok").length;
      const errCount = result.results.filter((r) => r.status === "error").length;
      if (errCount > 0) {
        const firstErr = result.results.find((r) => r.status === "error");
        toast.warning(`Completed with ${errCount} issue${errCount === 1 ? "" : "s"}`, {
          description: firstErr?.message
            ? `${okCount} applied. First error: ${firstErr.message}`
            : `${okCount} action${okCount === 1 ? "" : "s"} applied.`,
          duration: 9000,
          action: { label: "Retry failed", onClick: () => void handleExecute() },
        });
      } else {
        toast.success(result.summary, {
          description: `${okCount} action${okCount === 1 ? "" : "s"} applied.`,
        });
      }
    } catch (err: unknown) {
      const info = classifyCommandError(err);
      const isCredits = info.kind === "credits";
      toast.error(info.title, {
        description: info.message,
        duration: 9000,
        action: isCredits
          ? {
              label: "Top up",
              onClick: () =>
                router.navigate({
                  to: "/billing",
                  search: { required: undefined, plan: undefined } as never,
                }),
            }
          : { label: "Retry", onClick: () => void handleExecute() },
      });
      setTaskStatuses((prev) =>
        prev.map((s) =>
          s.status === "running" || s.status === "queued"
            ? { ...s, status: "failed" as const, message: info.message }
            : s,
        ),
      );
    } finally {
      clearInterval(runningTimer);
      setIsExecuting(false);
    }
  };

  const isEmpty = !metrics.loading && metrics.totalLeads === 0;
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {(() => {
              const h = new Date().getHours();
              const greeting =
                h < 5
                  ? "Working late"
                  : h < 12
                    ? "Good morning"
                    : h < 18
                      ? "Good afternoon"
                      : "Good evening";
              return firstName ? `${greeting}, ${firstName}` : "Command Center";
            })()}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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

          <div className="border-t border-border bg-background/40 px-5 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Runs CRM actions or hands off to your n8n workflows when configured.
            </p>
            <Button
              variant="command"
              size="sm"
              className="gap-1.5"
              onClick={handleExecute}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <>
                  <Zap className="h-3.5 w-3.5 animate-pulse" />
                  Executing…
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  {execution ? "Re-run" : "Execute"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {taskStatuses.length > 0 && <TaskStatusPanel items={taskStatuses} />}

      {execution && <ExecutionResults data={execution} />}

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
                Genesis needs leads before it can score, message, and convert. Add your first lead
                manually, import a CSV, or let our AI scout build a list for you.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/leads" search={{ action: "add" }}>
                  <Button variant="command" size="sm" className="gap-1.5">
                    Add a lead
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link to="/leads" search={{ action: "import" }}>
                  <Button variant="outline" size="sm">
                    Import CSV
                  </Button>
                </Link>
                <Link to="/advisor">
                  <Button variant="outline" size="sm">
                    Let AI find leads
                  </Button>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <CreditUsageWidget organizationId={organization?.id} />
        <WonDealsWidget organizationId={organization?.id} />
      </div>

      <div>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Pipeline</h2>
        </div>
        <PipelineView />
      </div>

      <AdvisorAuditLog />

      <ActivityFeed />
    </div>
  );
}

const ACTION_META: Record<ExecutionResult["type"], { label: string; Icon: typeof ListTodo }> = {
  create_task: { label: "Task", Icon: ListTodo },
  draft_message: { label: "Email draft", Icon: Mail },
  score_leads: { label: "Lead scoring", Icon: TrendingDown },
  create_campaign: { label: "Campaign", Icon: Megaphone },
  pipeline_summary: { label: "Pipeline summary", Icon: BarChart3 },
  note: { label: "Note", Icon: StickyNote },
  update_lead_status: { label: "Lead status", Icon: ArrowRightLeft },
  log_message: { label: "Logged message", Icon: MessageSquare },
  schedule_follow_up: { label: "Follow-up", Icon: CalendarClock },
  create_lead: { label: "New lead", Icon: UserPlus },
};

function ExecutionResults({ data }: { data: ExecuteCommandResponse }) {
  const okCount = data.results.filter((r) => r.status === "ok").length;
  const errCount = data.results.filter((r) => r.status === "error").length;
  const skipCount = data.results.filter((r) => r.status === "skipped").length;

  return (
    <div className="rounded-xl border border-success/20 bg-success/5 overflow-hidden">
      <div className="border-b border-success/20 bg-success/10 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCheck className="h-4 w-4 text-success" />
          <span className="text-sm font-semibold text-foreground">Done</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {okCount} applied{skipCount > 0 ? `, ${skipCount} skipped` : ""}
          {errCount > 0 ? `, ${errCount} failed` : ""}
        </span>
      </div>
      <p className="px-5 pt-3 text-sm text-foreground">{data.summary}</p>
      <ul className="px-5 py-3 space-y-2">
        {data.results.map((r, i) => {
          const meta = ACTION_META[r.type] ?? ACTION_META.note;
          const Icon = meta.Icon;
          const tone =
            r.status === "ok"
              ? "text-success"
              : r.status === "error"
                ? "text-destructive"
                : "text-muted-foreground";
          return (
            <li key={i} className="flex items-start gap-3">
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${tone}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {meta.label}
                  </span>
                  {r.handler === "n8n" && (
                    <span className="rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 uppercase tracking-wide">
                      n8n
                    </span>
                  )}
                  {r.status === "error" && <XCircle className="h-3 w-3 text-destructive" />}
                </div>
                <p className="text-sm text-foreground break-words">{r.message}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
