import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Send, MessageSquare, TrendingUp, Target, Zap, CheckCircle2, AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { CommandBar } from "@/components/crm/CommandBar";
import { MetricCard } from "@/components/crm/MetricCard";
import { ActivityFeed } from "@/components/crm/ActivityFeed";
import { PipelineView } from "@/components/crm/PipelineView";
import { executeCommandFn, type CommandPlan } from "@/functions/command.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "AI CRM — Dashboard" },
      { name: "description", content: "Autonomous AI-powered CRM dashboard" },
    ],
  }),
});

function Dashboard() {
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
        <p className="text-sm text-muted-foreground">Type a command to orchestrate your sales pipeline</p>
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
                <CheckCircle2 className="h-4 w-4 text-green-400" />
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
            <div className="border-t border-border bg-yellow-500/5 px-5 py-3">
              {plan.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-yellow-500" />
                  <span className="text-xs text-yellow-400">{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={Users} label="Total Leads" value="1,284" change="+12%" changeType="positive" />
        <MetricCard icon={Send} label="Outreach Sent" value="3,891" change="+8%" changeType="positive" />
        <MetricCard icon={MessageSquare} label="Replies" value="412" change="+23%" changeType="positive" />
        <MetricCard icon={TrendingUp} label="Conversion" value="14.2%" change="+2.1%" changeType="positive" />
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
