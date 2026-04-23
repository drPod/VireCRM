import { useState, useEffect, useCallback, useRef } from "react";
import { LeadCard, type Lead } from "./LeadCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const panState = useRef<{ active: boolean; startX: number; scrollLeft: number; moved: boolean }>({
    active: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });

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

  // Track scroll position to show/hide arrow affordances
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [loading, leads.length]);

  const scrollByAmount = useCallback((delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  // Click-and-drag panning on empty pipeline background (ignores card drags)
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    // Don't hijack pointer if user grabbed a draggable card or interactive element
    const target = e.target as HTMLElement;
    if (target.closest("[draggable='true'], button, a, input, textarea, select")) return;
    if (e.button !== 0) return;
    panState.current = {
      active: true,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const state = panState.current;
    const el = scrollRef.current;
    if (!state.active || !el) return;
    const dx = e.clientX - state.startX;
    if (Math.abs(dx) > 3) state.moved = true;
    el.scrollLeft = state.scrollLeft - dx;
  }, []);

  const endPan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    panState.current.active = false;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Edge fade + scroll button — left */}
      {canScrollLeft && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-background to-transparent z-10" />
          <button
            type="button"
            onClick={() => scrollByAmount(-320)}
            aria-label="Scroll pipeline left"
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      )}
      {/* Edge fade + scroll button — right */}
      {canScrollRight && (
        <>
          <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent z-10" />
          <button
            type="button"
            onClick={() => scrollByAmount(320)}
            aria-label="Scroll pipeline right"
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        className="flex gap-4 overflow-x-auto pb-4 scroll-smooth select-none cursor-grab active:cursor-grabbing [scrollbar-width:thin]"
      >
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
    </div>
  );
}
