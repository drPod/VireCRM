import { toast } from "sonner";
import { LeadCard, type Lead } from "@/components/crm/LeadCard";
import { deleteLeadWithRetry } from "@/lib/delete-lead-retry";
import { notifyLeadsChanged } from "@/lib/leads-events";
import type { BulkDeleteMode } from "@/lib/leads-types";

type LeadsListViewProps = {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  setTotalCount: React.Dispatch<React.SetStateAction<number>>;
  loading: boolean;
  isOwner: boolean;
  userId: string | undefined;
  selectedLeadIds: string[];
  setSelectedLeadIds: React.Dispatch<React.SetStateAction<string[]>>;
  onToggleSelected: (id: string, next: boolean) => void;
  onSendEmail: (lead: Lead) => void;
  onOpenDetail: (lead: Lead) => void;
};

export function LeadsListView({
  leads,
  setLeads,
  setTotalCount,
  loading,
  isOwner,
  userId,
  selectedLeadIds,
  setSelectedLeadIds,
  onToggleSelected,
  onSendEmail,
  onOpenDetail,
}: LeadsListViewProps) {
  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading leads"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 space-y-3 animate-pulse"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted/70" />
              </div>
              <div className="h-5 w-12 rounded-full bg-muted" />
            </div>
            <div className="h-3 w-2/3 rounded bg-muted/70" />
            <div className="flex gap-2 pt-2">
              <div className="h-7 w-20 rounded-md bg-muted" />
              <div className="h-7 w-20 rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const handleDelete = async (l: Lead, mode: BulkDeleteMode) => {
    // Optimistic remove — the row disappears instantly. Restore on error.
    const previousLeads = leads;
    setLeads((prev) => prev.filter((x) => x.id !== l.id));
    setSelectedLeadIds((prev) => prev.filter((id) => id !== l.id));
    setTotalCount((c) => Math.max(0, c - 1));

    const { data, error, attempts } = await deleteLeadWithRetry(l.id, mode);
    if (error) {
      setLeads(previousLeads);
      setTotalCount((c) => c + 1);
      toast.error(mode === "hard" ? "Couldn't delete lead" : "Couldn't archive lead", {
        description: `${l.name} — ${error.message} (after ${attempts} attempt${attempts === 1 ? "" : "s"})`,
        duration: 10000,
      });
      return;
    }
    const retryNote = attempts > 1 ? ` (succeeded on attempt ${attempts})` : "";
    if (mode === "hard") {
      const removed = (data as { removed?: Record<string, number> } | null)?.removed;
      const counts = removed
        ? Object.entries(removed)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`)
            .join(", ")
        : "";
      toast.success(`Deleted ${l.name}${retryNote}`, {
        description: counts ? `Also removed ${counts}.` : "No related records to remove.",
      });
    } else {
      toast.success(`Archived ${l.name}${retryNote}`, {
        description: "Tasks, messages, and conversations were preserved.",
      });
    }
    notifyLeadsChanged();
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {leads.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          selectable={isOwner}
          selected={selectedLeadIds.includes(lead.id)}
          onSelectedChange={(next) => onToggleSelected(lead.id, next)}
          onSendEmail={
            isOwner
              ? (l) => {
                  if (!l.email) {
                    toast.info("This lead has no email address.");
                    return;
                  }
                  onSendEmail(l);
                }
              : undefined
          }
          canDelete={isOwner || lead.createdBy === userId}
          onDelete={handleDelete}
          onClick={() => {
            // Per org policy, only the owner can open the full lead
            // detail drawer. Reps and managers see the card data only.
            if (!isOwner) {
              toast.info("Only the organization owner can open lead details.");
              return;
            }
            onOpenDetail(lead);
          }}
        />
      ))}
      {leads.length === 0 && (
        <div className="col-span-full rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No leads found matching your criteria
        </div>
      )}
    </div>
  );
}
