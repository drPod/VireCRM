import {
  ArrowDown,
  Bell,
  Filter,
  GitBranch,
  GitFork,
  Mail,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Timer,
  Workflow as WorkflowIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WORKFLOWS, type Workflow, type WorkflowStep } from "../data/workflows";

function stepIcon(type: WorkflowStep["type"]): LucideIcon {
  switch (type) {
    case "trigger":
      return Bell;
    case "filter":
      return Filter;
    case "action":
      return Mail;
    case "wait":
      return Timer;
    case "branch":
      return GitFork;
  }
}

function stepColor(type: WorkflowStep["type"]): string {
  switch (type) {
    case "trigger":
      return "bg-primary/15 text-primary border-primary/30";
    case "filter":
      return "bg-[oklch(0.65_0.18_280)]/15 text-[oklch(0.65_0.18_280)] border-[oklch(0.65_0.18_280)]/30";
    case "action":
      return "bg-success/15 text-success border-success/30";
    case "wait":
      return "bg-muted text-muted-foreground border-border";
    case "branch":
      return "bg-[oklch(0.7_0.18_50)]/15 text-[oklch(0.7_0.18_50)] border-[oklch(0.7_0.18_50)]/30";
  }
}

function statusBadge(s: Workflow["status"]) {
  if (s === "Live") return { cls: "bg-success/15 text-success border-success/30", Icon: Play };
  if (s === "Paused") return { cls: "bg-muted text-muted-foreground border-border", Icon: Pause };
  return { cls: "bg-muted/40 text-muted-foreground border-border", Icon: WorkflowIcon };
}

export function WorkflowsView() {
  const totals = WORKFLOWS.reduce(
    (acc, w) => {
      acc.enrolled += w.enrolled;
      acc.completed += w.completed;
      return acc;
    },
    { enrolled: 0, completed: 0 },
  );

  return (
    <div data-tour="workflows" className="space-y-6 scroll-mt-24">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active workflows</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {WORKFLOWS.filter((w) => w.status === "Live").length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Currently enrolled</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totals.enrolled}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed this month</p>
          <p className="mt-1 text-2xl font-bold text-success">{totals.completed}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Your workflows</h3>
        </div>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="command"
                size="sm"
                className="gap-1.5 cursor-not-allowed opacity-70"
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
              >
                <Plus className="h-3.5 w-3.5" />
                New workflow
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign up to build your own automation flows.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {WORKFLOWS.map((w) => {
          const status = statusBadge(w.status);
          return (
            <Card key={w.id} className="overflow-hidden">
              <div className="flex items-start justify-between border-b border-border/60 p-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{w.name}</h4>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.cls}`}
                    >
                      <status.Icon className="h-3 w-3" />
                      {w.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{w.description}</p>
                </div>
                <div className="text-right text-[10px] text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">{w.enrolled}</span> enrolled
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">{w.completed}</span> completed
                  </p>
                </div>
              </div>

              <div className="space-y-2 p-5">
                {w.steps.map((step, i) => {
                  const Icon = stepIcon(step.type);
                  return (
                    <div key={i}>
                      <div
                        className={`flex items-start gap-3 rounded-lg border bg-card/40 p-3 ${stepColor(
                          step.type,
                        )}`}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-card/80">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                            {step.type}
                          </p>
                          <p className="text-sm text-foreground">{step.label}</p>
                          {step.detail && (
                            <p className="text-[11px] text-muted-foreground">{step.detail}</p>
                          )}
                        </div>
                      </div>
                      {i < w.steps.length - 1 && (
                        <div className="flex h-4 justify-center" aria-hidden="true">
                          <ArrowDown className="h-3 w-3 text-muted-foreground/60" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <MessageCircle className="h-3 w-3" />
                  Time-zone aware · auto-paused on reply
                </div>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-not-allowed opacity-70"
                        aria-disabled="true"
                        onClick={(e) => e.preventDefault()}
                      >
                        Edit
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sign up to edit workflows.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
