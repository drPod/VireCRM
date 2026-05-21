import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { Lead } from "@/components/crm/LeadCard";
import type { BulkRecipient } from "@/components/crm/BulkApplyTemplateDialog";
import { notifyLeadsChanged } from "@/lib/leads-events";
import { deleteLeadWithRetry } from "@/lib/delete-lead-retry";
import type { BulkAssignMode, BulkDeleteMode } from "@/lib/leads-types";

type UseLeadsBulkActionsOptions = {
  organizationId: string | undefined;
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  totalCount: number;
  setTotalCount: React.Dispatch<React.SetStateAction<number>>;
  statusFilter: string;
  onChanged: () => void;
};

/**
 * Owns bulk-selection + bulk-mutation state for the leads page:
 *   - which lead ids are selected
 *   - bulk-assign targets + distribution mode (share / round-robin)
 *   - bulk-move target status
 *   - in-flight flags for move / delete / assign
 *   - confirmation-dialog open state for destructive ops
 *
 * Returns the runners and setters the UI binds to. Each runner does the
 * optimistic UI dance + rollback on error itself, so the container stays slim.
 */
export function useLeadsBulkActions({
  organizationId,
  leads,
  setLeads,
  totalCount,
  setTotalCount,
  statusFilter,
  onChanged,
}: UseLeadsBulkActionsOptions) {
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAssignTargets, setBulkAssignTargets] = useState<string[]>([]);
  // "share" = every lead → every employee (one shared lead, multiple assignees).
  // "round_robin" = distribute leads one-by-one across employees (each lead
  // gets exactly one assignee).
  const [bulkAssignMode, setBulkAssignMode] = useState<BulkAssignMode>("share");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  // Round-robin clears existing assignees, so we require explicit confirmation.
  const [confirmRoundRobinOpen, setConfirmRoundRobinOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMoveStatus, setBulkMoveStatus] = useState<string>("");
  const [bulkMoving, setBulkMoving] = useState(false);

  // Drop any selected ids that are no longer in the visible list (e.g. after
  // filtering or refresh).
  useEffect(() => {
    setSelectedLeadIds((prev) => prev.filter((id) => leads.some((l) => l.id === id)));
  }, [leads]);

  const visibleLeadIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const allVisibleSelected =
    visibleLeadIds.length > 0 && visibleLeadIds.every((id) => selectedLeadIds.includes(id));

  const bulkTemplateRecipients: BulkRecipient[] = useMemo(
    () =>
      leads
        .filter((l) => selectedLeadIds.includes(l.id))
        .map((l) => ({
          id: l.id,
          name: l.name,
          email: l.email || null,
          company: l.company ?? null,
        })),
    [leads, selectedLeadIds],
  );

  const toggleLeadSelected = useCallback((id: string, next: boolean) => {
    setSelectedLeadIds((prev) =>
      next ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id),
    );
  }, []);

  const handleSelectAllVisible = useCallback(() => {
    setSelectedLeadIds(allVisibleSelected ? [] : [...visibleLeadIds]);
  }, [allVisibleSelected, visibleLeadIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedLeadIds([]);
    setBulkAssignTargets([]);
    setBulkMoveStatus("");
  }, []);

  /**
   * Bulk move: relocate every selected lead to a new pipeline stage with an
   * optimistic update so the cards disappear/relocate instantly across the
   * leads list and the pipeline view (the latter listens for `leads:changed`).
   */
  const runBulkMove = useCallback(
    async (newStatus: string) => {
      if (selectedLeadIds.length === 0 || !newStatus) return;
      const ids = [...selectedLeadIds];
      const prevStatusById = new Map(
        leads.filter((l) => ids.includes(l.id)).map((l) => [l.id, l.status]),
      );
      setBulkMoving(true);
      setLeads((prev) => {
        const updated = prev.map((l) =>
          ids.includes(l.id) ? { ...l, status: newStatus as Lead["status"] } : l,
        );
        if (statusFilter !== "all" && statusFilter !== newStatus) {
          return updated.filter((l) => !ids.includes(l.id));
        }
        return updated;
      });
      notifyLeadsChanged();

      const { error } = await supabase.from("leads").update({ status: newStatus }).in("id", ids);

      setBulkMoving(false);

      if (error) {
        // Roll back to pre-move statuses and re-add any rows we filtered out.
        setLeads((prev) => {
          const restored = new Map(prev.map((l) => [l.id, l]));
          prevStatusById.forEach((status, id) => {
            const existing = restored.get(id);
            if (existing) {
              restored.set(id, { ...existing, status: status as Lead["status"] });
            }
          });
          return Array.from(restored.values());
        });
        notifyLeadsChanged();
        onChanged();
        toast.error("Failed to move leads", { description: error.message });
        return;
      }

      toast.success(`Moved ${ids.length} lead${ids.length === 1 ? "" : "s"} to ${newStatus}`);
      handleClearSelection();
    },
    [selectedLeadIds, leads, statusFilter, setLeads, onChanged, handleClearSelection],
  );

  const runBulkDelete = useCallback(
    async (mode: BulkDeleteMode) => {
      if (selectedLeadIds.length === 0) return;
      setBulkDeleting(true);
      const ids = [...selectedLeadIds];

      // Optimistic UI: remove rows immediately so the list feels instant.
      // We re-add any that fail below.
      const previousLeads = leads;
      const previousCount = totalCount;
      setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
      setTotalCount((c) => Math.max(0, c - ids.length));
      setBulkDeleteOpen(false);
      handleClearSelection();

      // Fire all deletes in parallel. Each one auto-retries with exponential
      // backoff (300ms, 900ms) on transient failures — fatal errors like
      // permission-denied / not-found short-circuit immediately.
      const nameById = new Map(previousLeads.map((l) => [l.id, l.name]));
      const results = await Promise.all(ids.map((id) => deleteLeadWithRetry(id, mode)));
      const failed = results.filter((r) => r.error);
      const success = results.length - failed.length;
      const retried = results.filter((r) => !r.error && r.attempts > 1).length;
      setBulkDeleting(false);

      if (success > 0) {
        const verb = mode === "hard" ? "Deleted" : "Archived";
        toast.success(`${verb} ${success} lead${success === 1 ? "" : "s"}`, {
          description: retried > 0 ? `${retried} succeeded after a retry.` : undefined,
        });
        notifyLeadsChanged();
      }
      if (failed.length > 0) {
        // Roll back the rows that didn't actually delete.
        const failedIds = new Set(failed.map((r) => r.id));
        setLeads(previousLeads.filter((l) => !ids.includes(l.id) || failedIds.has(l.id)));
        setTotalCount(previousCount - success);

        const failedNames = failed.map((r) => nameById.get(r.id) ?? r.id).slice(0, 5);
        const more = failed.length - failedNames.length;
        const list = failedNames.join(", ") + (more > 0 ? ` +${more} more` : "");
        const firstMsg = failed[0].error?.message ?? "Unknown error";
        toast.error(`${failed.length} lead${failed.length === 1 ? "" : "s"} failed after retries`, {
          description: `${list} — ${firstMsg}`,
          duration: 10000,
        });
      }
    },
    [selectedLeadIds, leads, totalCount, setLeads, setTotalCount, handleClearSelection],
  );

  /**
   * Bulk-assign with two distribution modes:
   *
   * 1. "share" — every selected lead is shared with every chosen employee
   *    (rows in the join table). The first picked employee becomes the
   *    primary assignee on `leads.assigned_to`.
   *
   * 2. "round_robin" — leads are distributed one-by-one across the chosen
   *    employees (lead 1 → emp A, lead 2 → emp B, lead 3 → emp A, …). Each
   *    lead ends up with exactly one assignee, and `leads.assigned_to`
   *    matches that single assignee. Existing assignees on the selected
   *    leads are replaced so the distribution is clean.
   */
  const runBulkAssign = useCallback(async () => {
    if (!organizationId) return;
    if (selectedLeadIds.length === 0 || bulkAssignTargets.length === 0) return;
    setBulkAssigning(true);
    try {
      if (bulkAssignMode === "round_robin") {
        // Build the lead → single-employee map by rotating through targets.
        const pairs = selectedLeadIds.map((leadId, idx) => ({
          leadId,
          userId: bulkAssignTargets[idx % bulkAssignTargets.length]!,
        }));

        // 1) Wipe existing join-table rows for these leads so we don't leave
        //    stale assignees behind from a previous "share" pass.
        const { error: delErr } = await supabase
          .from("lead_assignees")
          .delete()
          .in("lead_id", selectedLeadIds);
        if (delErr) throw delErr;

        // 2) Update primary assignee per lead. We have to issue one update
        //    per lead because each gets a different user_id.
        await Promise.all(
          pairs.map(({ leadId, userId }) =>
            supabase.from("leads").update({ assigned_to: userId }).eq("id", leadId),
          ),
        );

        // 3) Insert one join-table row per lead.
        const rows: TablesInsert<"lead_assignees">[] = pairs.map(({ leadId, userId }) => ({
          lead_id: leadId,
          user_id: userId,
          organization_id: organizationId,
        }));
        const { error: insErr } = await supabase
          .from("lead_assignees")
          .upsert(rows, { onConflict: "lead_id,user_id", ignoreDuplicates: true });
        if (insErr) throw insErr;

        toast.success(
          `Distributed ${selectedLeadIds.length} lead${
            selectedLeadIds.length === 1 ? "" : "s"
          } across ${bulkAssignTargets.length} employee${
            bulkAssignTargets.length === 1 ? "" : "s"
          } (round-robin)`,
        );
      } else {
        // "share" mode — original behavior.
        const [primaryTarget] = bulkAssignTargets;

        const { error: updErr } = await supabase
          .from("leads")
          .update({ assigned_to: primaryTarget })
          .in("id", selectedLeadIds);
        if (updErr) throw updErr;

        const rows: TablesInsert<"lead_assignees">[] = [];
        for (const leadId of selectedLeadIds) {
          for (const target of bulkAssignTargets) {
            rows.push({
              lead_id: leadId,
              user_id: target,
              organization_id: organizationId,
            });
          }
        }
        const { error: insErr } = await supabase
          .from("lead_assignees")
          .upsert(rows, { onConflict: "lead_id,user_id", ignoreDuplicates: true });
        if (insErr) throw insErr;

        toast.success(
          `Shared ${selectedLeadIds.length} lead${
            selectedLeadIds.length === 1 ? "" : "s"
          } with ${bulkAssignTargets.length} employee${bulkAssignTargets.length === 1 ? "" : "s"}`,
        );
      }
      handleClearSelection();
      onChanged();
    } catch (err) {
      console.error("[Leads] bulk-assign failed", err);
      toast.error(err instanceof Error ? err.message : "Bulk assign failed");
    } finally {
      setBulkAssigning(false);
    }
  }, [
    organizationId,
    selectedLeadIds,
    bulkAssignTargets,
    bulkAssignMode,
    handleClearSelection,
    onChanged,
  ]);

  /**
   * Entry point clicked by the user. Round-robin is destructive (it wipes
   * existing assignees on the selected leads), so we require an explicit
   * confirmation prompt before running. Share is additive and runs directly.
   */
  const handleBulkAssignClick = useCallback(() => {
    if (selectedLeadIds.length === 0) {
      toast.error("Select at least one lead first.");
      return;
    }
    if (bulkAssignTargets.length === 0) {
      toast.error("Pick at least one employee to assign to.");
      return;
    }
    if (bulkAssignMode === "round_robin") {
      setConfirmRoundRobinOpen(true);
      return;
    }
    void runBulkAssign();
  }, [selectedLeadIds, bulkAssignTargets, bulkAssignMode, runBulkAssign]);

  return {
    // selection
    selectedLeadIds,
    setSelectedLeadIds,
    visibleLeadIds,
    allVisibleSelected,
    toggleLeadSelected,
    handleSelectAllVisible,
    handleClearSelection,
    // bulk assign
    bulkAssignTargets,
    setBulkAssignTargets,
    bulkAssignMode,
    setBulkAssignMode,
    bulkAssigning,
    confirmRoundRobinOpen,
    setConfirmRoundRobinOpen,
    handleBulkAssignClick,
    runBulkAssign,
    // bulk delete
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkDeleting,
    runBulkDelete,
    // bulk move
    bulkMoveStatus,
    setBulkMoveStatus,
    bulkMoving,
    runBulkMove,
    // bulk template
    bulkTemplateRecipients,
  };
}
