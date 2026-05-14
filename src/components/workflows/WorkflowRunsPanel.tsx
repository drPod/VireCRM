import { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  PlayCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RunRow {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "paused";
  triggered_by: string;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  lead_id: string | null;
}

interface RunStep {
  id: string;
  node_id: string;
  node_kind: string;
  status: "ok" | "error" | "skipped";
  message: string | null;
  duration_ms: number | null;
  created_at: string;
}

const STATUS_META: Record<RunRow["status"], { icon: typeof Clock; color: string; label: string }> =
  {
    queued: { icon: Clock, color: "text-muted-foreground", label: "Queued" },
    running: { icon: Loader2, color: "text-primary animate-spin", label: "Running" },
    completed: { icon: CheckCircle2, color: "text-success", label: "Completed" },
    failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
    paused: { icon: PlayCircle, color: "text-amber-400", label: "Paused" },
  };

export function WorkflowRunsPanel({ workflowId }: { workflowId: string }) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, RunStep[]>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("workflow_runs")
        .select("id, status, triggered_by, error, started_at, finished_at, created_at, lead_id")
        .eq("workflow_id", workflowId)
        .order("created_at", { ascending: false })
        .limit(15);
      if (active) {
        setRuns((data ?? []) as RunRow[]);
        setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 4000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [workflowId]);

  const toggleExpand = async (runId: string) => {
    if (expanded === runId) {
      setExpanded(null);
      return;
    }
    setExpanded(runId);
    if (!steps[runId]) {
      const { data } = await supabase
        .from("workflow_run_steps")
        .select("id, node_id, node_kind, status, message, duration_ms, created_at")
        .eq("run_id", runId)
        .order("created_at", { ascending: true });
      setSteps((p) => ({ ...p, [runId]: (data ?? []) as RunStep[] }));
    }
  };

  if (loading) {
    return <div className="p-3 text-xs text-muted-foreground">Loading runs…</div>;
  }
  if (runs.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No runs yet. Click "Test run" to fire one.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {runs.map((run) => {
        const meta = STATUS_META[run.status];
        const Icon = meta.icon;
        const isOpen = expanded === run.id;
        return (
          <div key={run.id} className="text-xs">
            <button
              type="button"
              onClick={() => void toggleExpand(run.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/50"
            >
              {isOpen ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
              <span className="font-medium text-foreground">{meta.label}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{run.triggered_by}</span>
              <span className="ml-auto text-muted-foreground">
                {new Date(run.created_at).toLocaleTimeString()}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-1 bg-muted/20 px-6 py-2">
                {run.error && <p className="text-destructive">{run.error}</p>}
                {(steps[run.id] ?? []).map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span
                      className={
                        s.status === "error"
                          ? "text-destructive"
                          : s.status === "skipped"
                            ? "text-muted-foreground"
                            : "text-success"
                      }
                    >
                      {s.status === "ok" ? "✓" : s.status === "error" ? "✕" : "·"}
                    </span>
                    <span className="font-mono text-foreground">{s.node_kind}</span>
                    {s.message && <span className="text-muted-foreground">— {s.message}</span>}
                    {s.duration_ms ? (
                      <span className="ml-auto text-muted-foreground">{s.duration_ms}ms</span>
                    ) : null}
                  </div>
                ))}
                {(steps[run.id]?.length ?? 0) === 0 && (
                  <p className="text-muted-foreground">No steps recorded.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
