import { CheckCircle2, Circle, Clock, Loader2, XCircle, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "planned" | "queued" | "running" | "completed" | "failed" | "skipped";

export interface TaskStatusItem {
  step: number;
  action: string;
  detail?: string;
  status: StepStatus;
  handler?: "n8n" | "in_app";
  message?: string;
}

interface TaskStatusPanelProps {
  items: TaskStatusItem[];
}

const STATUS_META: Record<
  StepStatus,
  { label: string; Icon: typeof Circle; tone: string; dot: string }
> = {
  planned: {
    label: "Planned",
    Icon: Circle,
    tone: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
  queued: {
    label: "Queued",
    Icon: Clock,
    tone: "text-warning",
    dot: "bg-warning",
  },
  running: {
    label: "Running",
    Icon: Loader2,
    tone: "text-primary",
    dot: "bg-primary animate-pulse",
  },
  completed: {
    label: "Completed",
    Icon: CheckCircle2,
    tone: "text-success",
    dot: "bg-success",
  },
  failed: {
    label: "Failed",
    Icon: XCircle,
    tone: "text-destructive",
    dot: "bg-destructive",
  },
  skipped: {
    label: "Skipped",
    Icon: Circle,
    tone: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
};

export function TaskStatusPanel({ items }: TaskStatusPanelProps) {
  if (!items.length) return null;

  const counts = items.reduce<Record<StepStatus, number>>(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    {
      planned: 0,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    },
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border bg-muted/30 px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Task Status</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {(["planned", "queued", "running", "completed", "failed", "skipped"] as StepStatus[])
            .filter((s) => counts[s] > 0)
            .map((s) => {
              const meta = STATUS_META[s];
              return (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                  <span className={meta.tone}>
                    {counts[s]} {meta.label.toLowerCase()}
                  </span>
                </span>
              );
            })}
        </div>
      </div>

      <ol className="divide-y divide-border">
        {items.map((item) => {
          const meta = STATUS_META[item.status];
          const Icon = meta.Icon;
          const spin = item.status === "running";
          return (
            <li key={item.step} className="flex items-start gap-3 px-5 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {item.step}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{item.action}</span>
                  {item.handler === "n8n" && (
                    <span className="rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 uppercase tracking-wide">
                      n8n
                    </span>
                  )}
                </div>
                {item.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                )}
                {item.message && item.status !== "planned" && item.status !== "queued" && (
                  <p
                    className={cn(
                      "mt-1 text-xs break-words",
                      item.status === "failed" ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {item.message}
                  </p>
                )}
              </div>
              <div className={cn("flex items-center gap-1.5 text-xs shrink-0", meta.tone)}>
                <Icon className={cn("h-3.5 w-3.5", spin && "animate-spin")} />
                <span className="font-medium">{meta.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
