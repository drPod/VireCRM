import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_TYPE_BY_KIND, type WorkflowNodeKind } from "./nodeTypes";

export interface WorkflowNodeData {
  kind: WorkflowNodeKind;
  config: Record<string, unknown>;
  label?: string;
  [key: string]: unknown;
}

function summarizeConfig(kind: WorkflowNodeKind, config: Record<string, unknown>): string {
  switch (kind) {
    case "trigger.status_changed":
      return `${config.fromStatus ?? "any"} → ${config.toStatus ?? "any"}`;
    case "trigger.message_received":
      return `Channel: ${config.channel ?? "any"}`;
    case "action.send_email":
      return (config.subject as string) || "No subject set";
    case "action.add_tag":
      return (config.tag as string) ? `#${config.tag}` : "No tag set";
    case "action.wait":
      return `${config.amount ?? 1} ${config.unit ?? "days"}`;
    case "action.branch":
      return `${config.field ?? "?"} ${config.operator ?? "="} ${config.value ?? "?"}`;
    default:
      return "";
  }
}

export const WorkflowNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const meta = NODE_TYPE_BY_KIND[nodeData.kind];
  if (!meta) return null;
  const Icon = meta.icon;
  const summary = summarizeConfig(nodeData.kind, nodeData.config || {});

  const isTrigger = meta.category === "trigger";
  const isBranch = nodeData.kind === "action.branch";

  return (
    <div
      className={`min-w-[200px] rounded-xl border-2 bg-card shadow-md transition-all ${
        selected ? "border-primary shadow-lg" : "border-border"
      }`}
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2.5 !w-2.5 !border-2 !border-card !bg-primary"
        />
      )}
      <div className="flex items-start gap-2.5 p-3">
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${
            isTrigger
              ? "bg-primary/10 text-primary"
              : isBranch
                ? "bg-warning/10 text-warning"
                : "bg-success/10 text-success"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {meta.category}
          </div>
          <div className="text-sm font-semibold text-foreground">{meta.label}</div>
          {summary && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground" title={summary}>
              {summary}
            </div>
          )}
        </div>
      </div>
      {isBranch ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            style={{ left: "30%" }}
            className="!h-2.5 !w-2.5 !border-2 !border-card !bg-success"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{ left: "70%" }}
            className="!h-2.5 !w-2.5 !border-2 !border-card !bg-destructive"
          />
          <div className="flex justify-between px-3 pb-1.5 text-[9px] font-medium">
            <span className="text-success">TRUE</span>
            <span className="text-destructive">FALSE</span>
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2.5 !w-2.5 !border-2 !border-card !bg-primary"
        />
      )}
    </div>
  );
});
WorkflowNode.displayName = "WorkflowNode";
