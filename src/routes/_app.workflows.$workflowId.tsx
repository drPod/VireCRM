import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Save, Play, Pause, Zap, History } from "lucide-react";
import { toast } from "sonner";
import {
  NODE_TYPE_BY_KIND,
  TRIGGER_KIND_TO_DB,
  type WorkflowNodeKind,
} from "@/components/workflows/nodeTypes";
import { WorkflowNode } from "@/components/workflows/WorkflowNode";
import { NodePalette } from "@/components/workflows/NodePalette";
import { NodeInspector } from "@/components/workflows/NodeInspector";
import { WorkflowRunsPanel } from "@/components/workflows/WorkflowRunsPanel";

export const Route = createFileRoute("/_app/workflows/$workflowId")({
  component: WorkflowEditorPage,
  head: () => ({
    meta: [
      { title: "Workflow Editor — Genesis" },
      { name: "description", content: "Visual workflow builder" },
    ],
  }),
});

const nodeTypes = { workflow: WorkflowNode };

function WorkflowEditorPage() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}

function Editor() {
  const { workflowId } = Route.useParams();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const isNew = workflowId === "new";

  const [name, setName] = useState("Untitled workflow");
  const [status, setStatus] = useState<"draft" | "active" | "paused">("draft");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [showRuns, setShowRuns] = useState(false);

  const hasTrigger = useMemo(
    () =>
      nodes.some((n) => {
        const kind = (n.data as { kind?: string })?.kind;
        return typeof kind === "string" && kind.startsWith("trigger.");
      }),
    [nodes],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  // Load existing workflow
  useEffect(() => {
    if (isNew || !organization?.id) return;
    void (async () => {
      const { data, error } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", workflowId)
        .eq("organization_id", organization.id)
        .maybeSingle();
      if (error || !data) {
        toast.error("Workflow not found");
        navigate({ to: "/workflows" });
        return;
      }
      setName(data.name);
      setStatus(data.status as "draft" | "active" | "paused");
      const loadedNodes = (Array.isArray(data.nodes) ? data.nodes : []) as unknown as Node[];
      const loadedEdges = (Array.isArray(data.edges) ? data.edges : []) as unknown as Edge[];
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setLoading(false);
    })();
  }, [workflowId, organization?.id, isNew, navigate, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/workflow-node") as WorkflowNodeKind;
      if (!kind || !rfInstance || !wrapperRef.current) return;
      const meta = NODE_TYPE_BY_KIND[kind];
      if (!meta) return;

      // Enforce single trigger
      if (meta.category === "trigger" && hasTrigger) {
        toast.error("Only one trigger per workflow");
        return;
      }

      const position = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = `${kind}-${Date.now()}`;
      const newNode: Node = {
        id,
        type: "workflow",
        position,
        data: { kind, config: { ...meta.defaultConfig } },
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(id);
    },
    [rfInstance, hasTrigger, setNodes],
  );

  const updateNodeConfig = useCallback(
    (id: string, config: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...(n.data as object), config } }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
    },
    [setNodes, setEdges],
  );

  const handleSave = async (newStatus?: "draft" | "active" | "paused") => {
    if (!organization?.id) return;
    if (!hasTrigger) {
      toast.error("Add a trigger node first");
      return;
    }
    const triggerNode = nodes.find((n) => {
      const kind = (n.data as { kind?: string })?.kind;
      return typeof kind === "string" && kind.startsWith("trigger.");
    });
    const triggerKind = (triggerNode?.data as { kind: WorkflowNodeKind }).kind;
    const triggerConfig = (triggerNode?.data as { config: Record<string, unknown> }).config;

    setSaving(true);
    const finalStatus = newStatus ?? status;
    const payload = {
      organization_id: organization.id,
      name: name.trim() || "Untitled workflow",
      status: finalStatus,
      trigger_type: TRIGGER_KIND_TO_DB[triggerKind],
      trigger_config: triggerConfig as never,
      nodes: nodes as never,
      edges: edges as never,
    };

    const result = isNew
      ? await supabase.from("workflows").insert(payload).select("id").single()
      : await supabase.from("workflows").update(payload).eq("id", workflowId).select("id").single();

    setSaving(false);
    if (result.error) {
      toast.error("Save failed: " + result.error.message);
      return;
    }
    setStatus(finalStatus);
    toast.success(isNew ? "Workflow created" : "Saved");
    if (isNew && result.data?.id) {
      navigate({ to: "/workflows/$workflowId", params: { workflowId: result.data.id } });
    }
  };

  const handleTestRun = async () => {
    if (isNew) {
      toast.error("Save the workflow first");
      return;
    }
    if (!hasTrigger) {
      toast.error("Add a trigger node first");
      return;
    }
    setTestRunning(true);
    try {
      // Pick the most recent lead in this org as a sample target.
      const { data: lead } = await supabase
        .from("leads")
        .select("id, name")
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data, error } = await supabase.functions.invoke("run-workflow", {
        body: { workflow_id: workflowId, lead_id: lead?.id ?? null },
      });
      if (error) throw error;
      const status = (data as { status?: string })?.status ?? "completed";
      const targetMsg = lead?.name ? ` against ${lead.name}` : "";
      if (status === "completed") {
        toast.success(`Test run completed${targetMsg}`);
      } else if (status === "paused") {
        toast.info(`Run paused at a wait step${targetMsg}`);
      } else {
        toast.error(`Run ${status}: ${(data as { error?: string })?.error ?? "see logs"}`);
      }
      setShowRuns(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test run failed");
    } finally {
      setTestRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/workflows"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 max-w-xs border-transparent bg-transparent text-base font-semibold focus-visible:border-input focus-visible:bg-background"
          />
          <Badge variant={status === "active" ? "default" : "secondary"} className="text-[10px]">
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRuns((v) => !v)}
            className="gap-2"
          >
            <History className="h-3.5 w-3.5" />
            Runs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleTestRun()}
            disabled={testRunning || isNew}
            className="gap-2"
          >
            {testRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Test run
          </Button>
          {status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave("paused")}
              disabled={saving}
              className="gap-2"
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave("active")}
              disabled={saving}
              className="gap-2"
            >
              <Play className="h-3.5 w-3.5" />
              Activate
            </Button>
          )}
          <Button
            variant="command"
            size="sm"
            onClick={() => handleSave()}
            disabled={saving}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Canvas + panels */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette hasTrigger={hasTrigger} />
        <div ref={wrapperRef} className="relative flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={(_, n) => setSelectedNodeId(n.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} className="!bg-background" />
            <Controls className="!border-border !bg-card !shadow-md [&>button]:!border-border [&>button]:!bg-card [&>button]:!text-foreground" />
            <MiniMap
              className="!border !border-border !bg-card"
              nodeColor={() => "hsl(var(--primary))"}
              maskColor="hsl(var(--background) / 0.8)"
            />
          </ReactFlow>
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl border border-dashed border-border bg-card/80 p-6 text-center backdrop-blur">
                <p className="text-sm font-medium text-foreground">Drag a trigger from the left to get started</p>
                <p className="mt-1 text-xs text-muted-foreground">Then add actions and connect them</p>
              </div>
            </div>
          )}
        </div>
        <NodeInspector
          node={selectedNode}
          onUpdate={updateNodeConfig}
          onDelete={deleteNode}
        />
      </div>
    </div>
  );
}
