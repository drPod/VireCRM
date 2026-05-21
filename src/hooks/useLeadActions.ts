import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { notifyLeadsChanged } from "@/lib/leads-events";
import type { Lead } from "@/components/crm/LeadCard";
import type { LeadFormState } from "@/components/crm/LeadDetailDrawer.types";

type DealParse = { ok: true; cents: number } | { ok: false; error: string };

function parseDealValueCents(rawValue: string): DealParse {
  const raw = rawValue.trim();
  if (!raw) {
    return { ok: false, error: "Deal value is required — enter a positive amount" };
  }
  const cleaned = raw.replace(/[^\d.]/g, "");
  const n = cleaned ? Number(cleaned) : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: "Deal value must be greater than 0" };
  }
  return { ok: true, cents: Math.round(n * 100) };
}

interface UseLeadActionsParams {
  lead: Lead | null;
  organizationId: string | undefined;
  form: LeadFormState;
  update: (field: keyof LeadFormState, value: string | number) => void;
  canAssign: boolean;
  assigneeIds: string[];
  initialAssigneeIds: string[];
  setInitialAssigneeIds: (ids: string[]) => void;
  onUpdated: () => void;
  onOpenChange: (open: boolean) => void;
  onOptimisticPatch?: (id: string, patch: Partial<Lead>) => void;
  bumpActivityRefetch: () => void;
}

/**
 * Bundles the save / mark-as-won / delete orchestration for
 * `LeadDetailDrawer`. Returns the loading flags + handlers the drawer wires
 * into its detail-form props.
 */
export function useLeadActions({
  lead,
  organizationId,
  form,
  update,
  canAssign,
  assigneeIds,
  initialAssigneeIds,
  setInitialAssigneeIds,
  onUpdated,
  onOpenChange,
  onOptimisticPatch,
  bumpActivityRefetch,
}: UseLeadActionsParams) {
  const [saving, setSaving] = useState(false);
  const [markingWon, setMarkingWon] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const recordWonActivity = async (cents: number, currency: string) => {
    if (!lead || !organizationId) return;
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(cents / 100);
    await supabase.from("messages").insert({
      organization_id: organizationId,
      lead_id: lead.id,
      type: "lead_won",
      subject: `Lead marked as won — ${formatted}`,
      content: `${form.name.trim() || lead.name} was marked as won with a deal value of ${formatted}.`,
      status: "logged",
    });
  };

  const handleSave = async () => {
    if (!lead || !form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    // Parse annual kWh — accept blank, "12,000", "12000 kWh".
    let annualKwh: number | null = null;
    const rawKwh = form.annual_kwh.trim();
    if (rawKwh) {
      const cleaned = rawKwh.replace(/[^\d.]/g, "");
      const n = cleaned ? Math.round(Number(cleaned)) : NaN;
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Annual kWh must be a positive number");
        return;
      }
      annualKwh = n;
    }

    const dealParsed = parseDealValueCents(form.deal_value);
    if (!dealParsed.ok) {
      toast.error(dealParsed.error);
      return;
    }

    setSaving(true);
    const updatePayload: TablesUpdate<"leads"> = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      status: form.status,
      score: form.score,
      next_action: form.next_action.trim() || null,
      notes: form.notes.trim() || null,
      annual_kwh: annualKwh,
      contract_end_date: form.contract_end_date || null,
      current_supplier: form.current_supplier.trim() || null,
      deal_value_cents: dealParsed.cents,
      deal_currency: form.deal_currency || "USD",
    };
    // Only owners/managers may change assignees — DB trigger enforces too.
    // Primary assignee = first id in the multi-select (or null when empty).
    if (canAssign) {
      updatePayload.assigned_to = assigneeIds[0] ?? null;
    }

    // Optimistically patch the parent list/pipeline before the round-trip.
    // If the write fails, the next refetch (or realtime) will reconcile.
    onOptimisticPatch?.(lead.id, {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      company: form.company.trim() || undefined,
      status: form.status as Lead["status"],
      score: form.score,
      nextAction: form.next_action.trim() || undefined,
      annualKwh: annualKwh,
      contractEndDate: form.contract_end_date || null,
      currentSupplier: form.current_supplier.trim() || null,
      ...(canAssign ? { assignedTo: assigneeIds[0] ?? null } : {}),
    });

    const { error } = await supabase.from("leads").update(updatePayload).eq("id", lead.id);

    if (!error && canAssign && organizationId) {
      // Diff the join table so we add new assignees and remove dropped ones.
      const toAdd = assigneeIds.filter((id) => !initialAssigneeIds.includes(id));
      const toRemove = initialAssigneeIds.filter((id) => !assigneeIds.includes(id));
      if (toAdd.length > 0) {
        await supabase.from("lead_assignees").upsert(
          toAdd.map((user_id) => ({
            lead_id: lead.id,
            user_id,
            organization_id: organizationId,
          })),
          { onConflict: "lead_id,user_id", ignoreDuplicates: true },
        );
      }
      if (toRemove.length > 0) {
        await supabase
          .from("lead_assignees")
          .delete()
          .eq("lead_id", lead.id)
          .in("user_id", toRemove);
      }
      setInitialAssigneeIds(assigneeIds);
    }

    setSaving(false);
    if (error) {
      toast.error("Failed to update lead");
      // Roll back the optimistic patch by forcing a refetch from the server.
      onUpdated();
    } else {
      const transitionedToWon = form.status === "won" && lead.status !== "won";
      if (transitionedToWon) {
        await recordWonActivity(dealParsed.cents, form.deal_currency || "USD");
      }
      toast.success(form.status === "won" ? "Lead marked as won 🎉" : "Lead updated");
      onUpdated();
      notifyLeadsChanged();
      onOpenChange(false);
    }
  };

  const handleMarkWon = async () => {
    if (!lead) return;
    const dealParsed = parseDealValueCents(form.deal_value);
    if (!dealParsed.ok) {
      toast.error(dealParsed.error);
      return;
    }
    setMarkingWon(true);
    // Optimistic patch first.
    onOptimisticPatch?.(lead.id, {
      status: "won",
    });
    const { error } = await supabase
      .from("leads")
      .update({
        status: "won",
        deal_value_cents: dealParsed.cents,
        deal_currency: form.deal_currency || "USD",
      })
      .eq("id", lead.id);
    setMarkingWon(false);
    if (error) {
      toast.error("Failed to mark lead as won");
      onUpdated();
    } else {
      if (lead.status !== "won") {
        await recordWonActivity(dealParsed.cents, form.deal_currency || "USD");
      }
      toast.success("Lead marked as won 🎉");
      update("status", "won");
      bumpActivityRefetch();
      onUpdated();
      notifyLeadsChanged();
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete lead");
    } else {
      toast.success("Lead deleted");
      onUpdated();
      onOpenChange(false);
    }
  };

  return {
    saving,
    markingWon,
    deleting,
    confirmDelete,
    setConfirmDelete,
    handleSave,
    handleMarkWon,
    handleDelete,
  };
}
