import { ArrowRight, CheckCircle2, Loader2, Sparkles, Terminal, Zap } from "lucide-react";

const STEPS: { label: string; status: "done" | "running" | "queued"; meta?: string }[] = [
  { label: "Parse intent — \"chase warm energy leads\"", status: "done", meta: "0.4s" },
  { label: "Pull 28 matching leads from Energy pipeline", status: "done", meta: "0.9s" },
  { label: "Draft personalized 3-step sequence", status: "done", meta: "1.7s" },
  { label: "Schedule sends for 9:42 AM tomorrow", status: "running" },
  { label: "Enroll leads in workflow + notify owner", status: "queued" },
];

export function CommandCenterMock() {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/12 via-card to-[oklch(0.65_0.16_320)]/15 px-4 py-3 shadow-inner">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Terminal className="h-3.5 w-3.5" />
        </span>
        <p className="flex-1 text-sm text-foreground">
          <span className="text-muted-foreground">/</span> chase the energy leads that went cold
          last week
        </p>
        <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          ⌘K
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Plan
          </div>
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
            Auto-approved
          </span>
        </div>
        <ul className="space-y-2">
          {STEPS.map((step, i) => (
            <li
              key={step.label}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-card text-xs font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <span className="flex-1 text-sm text-foreground">{step.label}</span>
              {step.status === "done" ? (
                <span className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {step.meta}
                </span>
              ) : step.status === "running" ? (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Queued</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" /> 28 leads enrolled · 3 follow-ups queued
        </span>
        <span className="inline-flex items-center gap-1 text-primary">
          Open campaign <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}
