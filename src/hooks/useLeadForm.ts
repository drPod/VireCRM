import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/components/crm/LeadCard";
import type { LeadFormState, OrgMember } from "@/components/crm/LeadDetailDrawer.types";

const EMPTY_FORM: LeadFormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  status: "new",
  score: 50,
  next_action: "",
  notes: "",
  annual_kwh: "",
  contract_end_date: "",
  current_supplier: "",
  deal_value: "",
  deal_currency: "USD",
  assigned_to: "",
};

/**
 * Hook that owns the editable lead-form state for `LeadDetailDrawer`.
 *
 * Responsibilities:
 * - Resets the form on `lead` change (list view doesn't include notes / energy
 *   fields / deal value, so a follow-up fetch fills them in).
 * - Maintains assignee state (multi-assignee join table) + initial snapshot so
 *   the save handler can diff adds vs. removes.
 * - Loads org members so owner/manager assignee pickers can render names.
 *
 * The drawer's save/won/delete handlers stay in the component because they
 * coordinate with the parent's optimistic-patch + `onUpdated` callbacks.
 */
export function useLeadForm(lead: Lead | null, organizationId: string | undefined) {
  const [form, setForm] = useState<LeadFormState>(EMPTY_FORM);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  // Multi-assignee state — sourced from the lead_assignees join table.
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [initialAssigneeIds, setInitialAssigneeIds] = useState<string[]>([]);

  // Load org members so owners/managers can pick an assignee.
  useEffect(() => {
    if (!organizationId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("organization_id", organizationId),
        supabase.from("user_roles").select("user_id, role").eq("organization_id", organizationId),
      ]);
      if (cancelled) return;
      const roleByUser = new Map<string, string>();
      rolesRes.data?.forEach((r) => {
        if (r.user_id) roleByUser.set(r.user_id, r.role);
      });
      const list = (profilesRes.data ?? []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name ?? "Unnamed",
        role: roleByUser.get(p.user_id) ?? "sales_rep",
      }));
      setMembers(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!lead) return;

    setForm({
      name: lead.name,
      email: lead.email || "",
      phone: lead.phone || "",
      company: lead.company || "",
      status: lead.status,
      score: lead.score,
      next_action: lead.nextAction || "",
      notes: "",
      annual_kwh:
        typeof lead.annualKwh === "number" && lead.annualKwh >= 0 ? String(lead.annualKwh) : "",
      contract_end_date: lead.contractEndDate ?? "",
      current_supplier: lead.currentSupplier ?? "",
      deal_value: "",
      deal_currency: "USD",
      assigned_to: lead.assignedTo ?? "",
    });

    // Fetch the full notes + energy + deal + assignment fields (the list view doesn't include them).
    setLoadingNotes(true);
    Promise.all([
      supabase
        .from("leads")
        .select(
          "notes, annual_kwh, contract_end_date, current_supplier, deal_value_cents, deal_currency, assigned_to",
        )
        .eq("id", lead.id)
        .single(),
      supabase.from("lead_assignees").select("user_id").eq("lead_id", lead.id),
    ]).then(([leadRes, assigneeRes]) => {
      const data = leadRes.data;
      if (data) {
        setForm((prev) => ({
          ...prev,
          notes: data.notes ?? "",
          annual_kwh:
            typeof data.annual_kwh === "number" && data.annual_kwh >= 0
              ? String(data.annual_kwh)
              : prev.annual_kwh,
          contract_end_date: data.contract_end_date ?? prev.contract_end_date,
          current_supplier: data.current_supplier ?? prev.current_supplier,
          deal_value:
            typeof data.deal_value_cents === "number" && data.deal_value_cents > 0
              ? (data.deal_value_cents / 100).toString()
              : "",
          deal_currency: data.deal_currency ?? "USD",
          assigned_to: data.assigned_to ?? prev.assigned_to,
        }));
      }
      const ids = (assigneeRes.data ?? []).map((r) => r.user_id);
      // Fall back to the legacy single column if the join table is empty.
      const fallback = ids.length === 0 && data?.assigned_to ? [data.assigned_to] : ids;
      setAssigneeIds(fallback);
      setInitialAssigneeIds(fallback);
      setLoadingNotes(false);
    });
  }, [lead]);

  const update = (field: keyof LeadFormState, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return {
    form,
    update,
    loadingNotes,
    members,
    assigneeIds,
    setAssigneeIds,
    initialAssigneeIds,
    setInitialAssigneeIds,
  };
}
