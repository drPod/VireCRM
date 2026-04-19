import { useState, useEffect, useCallback } from "react";
import { LeadCard, type Lead } from "./LeadCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const stages = [
  { key: "new" as const, label: "New" },
  { key: "contacted" as const, label: "Contacted" },
  { key: "qualified" as const, label: "Qualified" },
  { key: "negotiation" as const, label: "Negotiation" },
  { key: "won" as const, label: "Won" },
];

export function PipelineView() {
  const { organization } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("organization_id", organization.id)
      .order("score", { ascending: false });

    if (data) {
      setLeads(
        data.map((l) => ({
          id: l.id,
          name: l.name,
          email: l.email ?? "",
          phone: l.phone ?? undefined,
          company: l.company ?? undefined,
          status: l.status as Lead["status"],
          score: l.score ?? 0,
          nextAction: l.next_action ?? undefined,
          lastContact: l.last_contact ?? undefined,
        }))
      );
    }
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleDragStart = useCallback((e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", leadId);
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedLeadId(null);
    setDropTarget(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(stageKey);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, stageKey: string) => {
    // Only clear if actually leaving the column (not entering a child)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      setDropTarget((prev) => (prev === stageKey ? null : prev));
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, newStatus: string) => {
      e.preventDefault();
      setDropTarget(null);

      const leadId = e.dataTransfer.getData("text/plain");
      if (!leadId) return;

      const lead = leads.find((l) => l.id === leadId);
      if (!lead || lead.status === newStatus) return;

      // Optimistic update
      const oldStatus = lead.status;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: newStatus as Lead["status"] } : l
        )
      );
      setUpdating(leadId);

      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);

      setUpdating(null);

      if (error) {
        // Revert on failure
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: oldStatus } : l
          )
        );
        toast.error("Failed to update lead status");
      } else {
        toast.success(`Moved "${lead.name}" to ${newStatus}`);
      }
    },
    [leads]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageLeads = leads.filter((l) => l.status === stage.key);
        const isOver = dropTarget === stage.key && draggedLeadId !== null;
        const draggedLead = draggedLeadId ? leads.find((l) => l.id === draggedLeadId) : null;
        const isDraggedFromThisColumn = draggedLead?.status === stage.key;

        return (
          <div
            key={stage.key}
            className={`w-72 shrink-0 rounded-xl p-2 transition-colors duration-200 ${
              isOver && !isDraggedFromThisColumn
                ? "bg-primary/5 ring-2 ring-primary/30 ring-inset"
                : "bg-transparent"
            }`}
            onDragOver={(e) => handleDragOver(e, stage.key)}
            onDragLeave={(e) => handleDragLeave(e, stage.key)}
            onDrop={(e) => handleDrop(e, stage.key)}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground">
                {stageLeads.length}
              </span>
            </div>
            <div className="space-y-3 min-h-[60px]">
              {stageLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-grab active:cursor-grabbing transition-opacity ${
                    draggedLeadId === lead.id ? "opacity-50" : ""
                  } ${updating === lead.id ? "pointer-events-none opacity-70" : ""}`}
                >
                  <LeadCard lead={lead} />
                  {updating === lead.id && (
                    <div className="flex items-center justify-center -mt-2 pb-1">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              ))}
              {stageLeads.length === 0 && (
                <div
                  className={`rounded-lg border border-dashed p-6 text-center text-xs transition-colors ${
                    isOver && !isDraggedFromThisColumn
                      ? "border-primary/40 text-primary/60 bg-primary/5"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {isOver && !isDraggedFromThisColumn ? "Drop here" : "No leads"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
