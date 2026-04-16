import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Plus,
  Play,
  Pause,
  MoreHorizontal,
  GitBranch,
  Mail,
  MessageSquare,
  Clock,
  Users,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/_app/workflows")({
  component: WorkflowsPage,
  head: () => ({
    meta: [
      { title: "Vireon — Workflows" },
      { name: "description", content: "Visual workflow automation builder" },
    ],
  }),
});

const demoWorkflows = [
  {
    id: "1",
    name: "New Lead Welcome Sequence",
    description: "Sends welcome email → waits 1 day → SMS follow-up → assigns to rep",
    status: "active" as const,
    trigger: "New lead created",
    steps: 4,
    enrolled: 1247,
    completed: 983,
    lastRun: "2 minutes ago",
  },
  {
    id: "2",
    name: "Hot Lead Auto-Booking",
    description: "Score > 80 → AI message → Calendar link → Reminder sequence",
    status: "active" as const,
    trigger: "Lead score updated",
    steps: 6,
    enrolled: 342,
    completed: 198,
    lastRun: "15 minutes ago",
  },
  {
    id: "3",
    name: "Re-engagement Campaign",
    description: "No contact 30 days → Email drip → SMS nudge → Pipeline update",
    status: "paused" as const,
    trigger: "Inactivity timer",
    steps: 5,
    enrolled: 856,
    completed: 421,
    lastRun: "3 days ago",
  },
  {
    id: "4",
    name: "Deal Won Onboarding",
    description: "Pipeline → Won → Welcome kit → Calendar invite → Task creation",
    status: "active" as const,
    trigger: "Deal stage changed",
    steps: 7,
    enrolled: 89,
    completed: 76,
    lastRun: "1 hour ago",
  },
  {
    id: "5",
    name: "Review Request After Service",
    description: "Service complete → Wait 2 days → Review request email → SMS reminder",
    status: "draft" as const,
    trigger: "Task completed",
    steps: 3,
    enrolled: 0,
    completed: 0,
    lastRun: "Never",
  },
];

const triggerIcons: Record<string, typeof Zap> = {
  "New lead created": Users,
  "Lead score updated": Zap,
  "Inactivity timer": Clock,
  "Deal stage changed": GitBranch,
  "Task completed": CheckCircle2,
};

function WorkflowsPage() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Automate multi-step sequences across email, SMS, tasks, and pipeline updates
            </p>
          </div>
          <Button variant="command" className="gap-2">
            <Plus className="h-4 w-4" />
            Create Workflow
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-4 gap-4">
          {[
            { label: "Active Workflows", value: "3", color: "text-success" },
            { label: "Total Enrolled", value: "2,534", color: "text-primary" },
            { label: "Completed", value: "1,678", color: "text-foreground" },
            { label: "Conversion Rate", value: "66.2%", color: "text-warning" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Workflow List */}
        <div className="space-y-3">
          {demoWorkflows.map((wf) => {
            const TriggerIcon = triggerIcons[wf.trigger] || Zap;
            return (
              <div
                key={wf.id}
                className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <TriggerIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{wf.name}</h3>
                        <Badge
                          variant={
                            wf.status === "active" ? "default" : wf.status === "paused" ? "secondary" : "outline"
                          }
                          className="text-xs"
                        >
                          {wf.status === "active" && <Play className="mr-1 h-2.5 w-2.5" />}
                          {wf.status === "paused" && <Pause className="mr-1 h-2.5 w-2.5" />}
                          {wf.status === "draft" && <AlertCircle className="mr-1 h-2.5 w-2.5" />}
                          {wf.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{wf.description}</p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" /> {wf.steps} steps
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {wf.enrolled.toLocaleString()} enrolled
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {wf.completed.toLocaleString()} completed
                        </span>
                        <span>Last run: {wf.lastRun}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="outline" size="sm" className="gap-1">
                      Edit <ArrowRight className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Visual step preview */}
                <div className="mt-4 flex items-center gap-2 pl-14">
                  {Array.from({ length: wf.steps }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted text-xs font-medium text-muted-foreground">
                        {i === 0 ? (
                          <Zap className="h-3 w-3" />
                        ) : i % 3 === 1 ? (
                          <Mail className="h-3 w-3" />
                        ) : i % 3 === 2 ? (
                          <MessageSquare className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                      </div>
                      {i < wf.steps - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/40" />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
