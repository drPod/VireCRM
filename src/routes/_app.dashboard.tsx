import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Send, MessageSquare, TrendingUp, Target, Zap } from "lucide-react";
import { CommandBar } from "@/components/crm/CommandBar";
import { MetricCard } from "@/components/crm/MetricCard";
import { ActivityFeed } from "@/components/crm/ActivityFeed";
import { PipelineView } from "@/components/crm/PipelineView";

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
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const handleCommand = (command: string) => {
    setIsProcessing(true);
    setLastCommand(command);
    setTimeout(() => setIsProcessing(false), 2000);
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
            Processing: <span className="font-medium text-primary">{lastCommand}</span>
          </span>
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
