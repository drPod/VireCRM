import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/components/crm/LeadCard";
import { onLeadsChanged } from "@/lib/leads-events";

type UseLeadsListOptions = {
  organizationId: string | undefined;
  isOwner: boolean;
  statusFilter: string;
  search: string;
  assigneeFilter: string[];
};

type UseLeadsListResult = {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  loading: boolean;
  totalCount: number;
  setTotalCount: React.Dispatch<React.SetStateAction<number>>;
  refresh: () => void;
};

/**
 * Owns the leads-list data: query + assignee/share joins, realtime sync,
 * and the cross-component `leads:changed` signal.
 *
 * Returns the mutable list setters so callers can do optimistic UI for
 * delete / move / patch without rewiring the fetch.
 */
export function useLeadsList({
  organizationId,
  isOwner,
  statusFilter,
  search,
  assigneeFilter,
}: UseLeadsListOptions): UseLeadsListResult {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!organizationId) return;

    const fetchLeads = async () => {
      setLoading(true);

      // If filtering by assignee, first resolve which lead ids match in the
      // join table (union/OR across the selected employees), then constrain
      // the leads query to those ids.
      let restrictedIds: string[] | null = null;
      if (isOwner && assigneeFilter.length > 0) {
        const { data: matches } = await supabase
          .from("lead_assignees")
          .select("lead_id")
          .eq("organization_id", organizationId)
          .in("user_id", assigneeFilter);
        restrictedIds = Array.from(new Set((matches ?? []).map((m) => m.lead_id)));
        if (restrictedIds.length === 0) {
          setLeads([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from("leads")
        .select("*", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (restrictedIds) {
        query = query.in("id", restrictedIds);
      }

      if (search.trim()) {
        // Sanitize search input: strip PostgREST metacharacters and limit length
        const sanitized = search
          .trim()
          .slice(0, 200)
          .replace(/[,.()"'\\]/g, "");
        if (sanitized) {
          query = query.or(
            `name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,company.ilike.%${sanitized}%`,
          );
        }
      }

      const [{ data, count, error }, profilesRes] = await Promise.all([
        query,
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("organization_id", organizationId),
      ]);

      const nameByUserId = new Map<string, string>();
      profilesRes.data?.forEach((p) => {
        if (p.user_id) nameByUserId.set(p.user_id, p.full_name ?? "Unnamed");
      });

      // Fetch all assignees + share counts for the visible leads in one round-trip.
      const leadIds = (data ?? []).map((l) => l.id);
      const assigneesByLead = new Map<string, Array<{ user_id: string; full_name: string }>>();
      const shareCountByLead = new Map<string, number>();
      if (leadIds.length > 0) {
        const [assigneeRes, sharesRes] = await Promise.all([
          supabase.from("lead_assignees").select("lead_id, user_id").in("lead_id", leadIds),
          supabase.from("lead_shares").select("lead_id").in("lead_id", leadIds),
        ]);
        assigneeRes.data?.forEach((r) => {
          const list = assigneesByLead.get(r.lead_id) ?? [];
          list.push({
            user_id: r.user_id,
            full_name: nameByUserId.get(r.user_id) ?? "Unnamed",
          });
          assigneesByLead.set(r.lead_id, list);
        });
        sharesRes.data?.forEach((r) => {
          shareCountByLead.set(r.lead_id, (shareCountByLead.get(r.lead_id) ?? 0) + 1);
        });
      }

      if (!error && data) {
        setLeads(
          data.map((l) => {
            const list = assigneesByLead.get(l.id) ?? [];
            // Fall back to the legacy single-assignee column if the join
            // table hasn't been backfilled for this lead yet.
            if (list.length === 0 && l.assigned_to) {
              list.push({
                user_id: l.assigned_to,
                full_name: nameByUserId.get(l.assigned_to) ?? "Unnamed",
              });
            }
            return {
              id: l.id,
              name: l.name,
              email: l.email ?? "",
              phone: l.phone ?? undefined,
              company: l.company ?? undefined,
              status: l.status as Lead["status"],
              score: l.score ?? 0,
              nextAction: l.next_action ?? undefined,
              lastContact: l.last_contact ?? undefined,
              annualKwh: l.annual_kwh ?? null,
              contractEndDate: l.contract_end_date ?? null,
              currentSupplier: l.current_supplier ?? null,
              assignedTo: l.assigned_to ?? null,
              assigneeName: l.assigned_to
                ? (nameByUserId.get(l.assigned_to) ?? null)
                : (list[0]?.full_name ?? null),
              assignees: list,
              createdBy: (l as { created_by?: string | null }).created_by ?? null,
              shareCount: shareCountByLead.get(l.id) ?? 0,
            };
          }),
        );
        setTotalCount(count ?? data.length);
      }
      setLoading(false);
    };

    fetchLeads();
  }, [organizationId, statusFilter, search, refreshKey, isOwner, assigneeFilter]);

  // Realtime: refresh the list whenever a lead in this org is inserted,
  // updated, or deleted (e.g. by another user, AI command, CSV import,
  // public booking flow). Debounced via setRefreshKey to coalesce bursts.
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`leads-list-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => setRefreshKey((k) => k + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  // Cross-component signal: soft deletes flip RLS visibility on UPDATE, so
  // realtime subscribers don't always receive the change. Listen for the
  // local `leads:changed` event and refetch.
  useEffect(() => onLeadsChanged(() => setRefreshKey((k) => k + 1)), []);

  return { leads, setLeads, loading, totalCount, setTotalCount, refresh };
}
