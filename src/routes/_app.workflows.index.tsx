import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Plus,
  Play,
  Pause,
  GitBranch,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Loader2,
  Trash2,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/workflows/")({
  component: WorkflowsListPage,
  head: () => ({
    meta: [
      { title: "Genesis — Workflows" },
      { name: "description", content: "Visual workflow automation builder" },
    ],
  }),
});

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused";
  trigger_type: "lead_created" | "status_changed" | "message_received";
  nodes: unknown[];
  enrolled_count: number;
  completed_count: number;
  last_run_at: string | null;
  updated_at: string;
}

const triggerIcons = {
  lead_created: Users,
  status_changed: Zap,
  message_received: MessageSquare,
} as const;

const triggerLabels = {
  lead_created: "New lead created",
  status_changed: "Lead status changed",
  message_received: "Message received",
} as const;

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function WorkflowsListPage() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id) return;
    void loadWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const loadWorkflows = async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("workflows")
      .select("id, name, description, status, trigger_type, nodes, enrolled_count, completed_count, last_run_at, updated_at")
      .eq("organization_id", organization.id)
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Failed to load workflows: " + error.message);
    } else {
      setWorkflows((data || []) as unknown as Workflow[]);
    }
    setLoading(false);
  };

  const toggleStatus = async (wf: Workflow) => {
    const next = wf.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("workflows").update({ status: next }).eq("id", wf.id);
    if (error) {
      toast.error("Update failed: " + error.message);
      return;
    }
    toast.success(next === "active" ? "Workflow activated" : "Workflow paused");
    void loadWorkflows();
  };

  const deleteWorkflow = async (wf: Workflow) => {
    if (!confirm(`Delete "${wf.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("workflows").delete().eq("id", wf.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    toast.success("Workflow deleted");
    void loadWorkflows();
  };

  const stats = {
    active: workflows.filter((w) => w.status === "active").length,
    enrolled: workflows.reduce((sum, w) => sum + w.enrolled_count, 0),
    completed: workflows.reduce((sum, w) => sum + w.completed_count, 0),
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Automate multi-step sequences across email, tags, waits, and conditional branches
            </p>
          </div>
          <Button
            variant="command"
            className="gap-2"
            onClick={() => navigate({ to: "/workflows/$workflowId", params: { workflowId: "new" } })}
          >
            <Plus className="h-4 w-4" />
            Create Workflow
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-4 gap-4">
          {[
            { label: "Active Workflows", value: String(stats.active), color: "text-success" },
            { label: "Total Enrolled", value: stats.enrolled.toLocaleString(), color: "text-primary" },
            { label: "Completed", value: stats.completed.toLocaleString(), color: "text-foreground" },
            {
              label: "Conversion Rate",
              value: stats.enrolled > 0 ? `${((stats.completed / stats.enrolled) * 100).toFixed(1)}%` : "—",
              color: "text-warning",
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <Zap className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-4 text-sm font-semibold text-foreground">No workflows yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Build your first automation. Drag triggers and actions onto the canvas, connect them,
              and turn it on.
            </p>
            <Button
              variant="command"
              onClick={() => navigate({ to: "/workflows/$workflowId", params: { workflowId: "new" } })}
              className="mt-4 gap-2"
            >
              <Plus className="h-4 w-4" />
              Create your first workflow
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((wf) => {
              const TriggerIcon = triggerIcons[wf.trigger_type] || Zap;
              const stepCount = Array.isArray(wf.nodes) ? wf.nodes.length : 0;
              return (
                <div
                  key={wf.id}
                  className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      to="/workflows/$workflowId"
                      params={{ workflowId: wf.id }}
                      className="flex flex-1 items-start gap-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <TriggerIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{wf.name}</h3>
                          <Badge
                            variant={
                              wf.status === "active"
                                ? "default"
                                : wf.status === "paused"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-xs"
                          >
                            {wf.status === "active" && <Play className="mr-1 h-2.5 w-2.5" />}
                            {wf.status === "paused" && <Pause className="mr-1 h-2.5 w-2.5" />}
                            {wf.status === "draft" && <AlertCircle className="mr-1 h-2.5 w-2.5" />}
                            {wf.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Trigger: {triggerLabels[wf.trigger_type]}
                        </p>
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" /> {stepCount} {stepCount === 1 ? "step" : "steps"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {wf.enrolled_count.toLocaleString()} enrolled
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {wf.completed_count.toLocaleString()} completed
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Last run: {formatRelative(wf.last_run_at)}
                          </span>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {wf.status !== "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleStatus(wf)}
                          title={wf.status === "active" ? "Pause" : "Activate"}
                        >
                          {wf.status === "active" ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigate({ to: "/workflows/$workflowId", params: { workflowId: wf.id } })}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => deleteWorkflow(wf)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
