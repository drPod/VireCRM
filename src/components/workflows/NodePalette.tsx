import { NODE_TYPES, type WorkflowNodeKind } from "./nodeTypes";

interface NodePaletteProps {
  hasTrigger: boolean;
}

export function NodePalette({ hasTrigger }: NodePaletteProps) {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>, kind: WorkflowNodeKind) => {
    e.dataTransfer.setData("application/workflow-node", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  const grouped = {
    trigger: NODE_TYPES.filter((n) => n.category === "trigger"),
    action: NODE_TYPES.filter((n) => n.category === "action"),
    logic: NODE_TYPES.filter((n) => n.category === "logic"),
    ai: NODE_TYPES.filter((n) => n.category === "ai"),
  };

  return (
    <div className="flex h-full w-64 flex-col gap-4 overflow-y-auto border-r border-border bg-card p-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Drag to canvas
        </h3>
      </div>

      <PaletteSection
        title="Triggers"
        hint={hasTrigger ? "Already added" : "Start here — pick one"}
        items={grouped.trigger}
        disabled={hasTrigger}
        onDragStart={onDragStart}
      />
      <PaletteSection title="AI Agents" items={grouped.ai} onDragStart={onDragStart} />
      <PaletteSection title="Actions" items={grouped.action} onDragStart={onDragStart} />
      <PaletteSection title="Logic" items={grouped.logic} onDragStart={onDragStart} />
    </div>
  );
}

function PaletteSection({
  title,
  hint,
  items,
  disabled,
  onDragStart,
}: {
  title: string;
  hint?: string;
  items: typeof NODE_TYPES;
  disabled?: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, kind: WorkflowNodeKind) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
          {title}
        </h4>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="space-y-1.5">
        {items.map((meta) => {
          const Icon = meta.icon;
          return (
            <div
              key={meta.kind}
              draggable={!disabled}
              onDragStart={(e) => !disabled && onDragStart(e, meta.kind)}
              className={`flex items-center gap-2 rounded-lg border border-border bg-background p-2 text-sm transition-all ${
                disabled
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-grab hover:border-primary/40 hover:bg-accent active:cursor-grabbing"
              }`}
            >
              <div
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${
                  meta.category === "trigger"
                    ? "bg-primary/10 text-primary"
                    : meta.category === "logic"
                      ? "bg-warning/10 text-warning"
                      : meta.category === "ai"
                        ? "bg-purple-500/10 text-purple-400"
                        : "bg-success/10 text-success"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground">{meta.label}</div>
                <div className="truncate text-[10px] text-muted-foreground">{meta.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
