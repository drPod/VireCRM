import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardMetrics {
  loading: boolean;
  totalLeads: number;
  newLeads30d: number;
  outreachSent: number;
  replies: number;
  conversionRate: number; // 0..100
  refresh: () => Promise<void>;
}

/**
 * Counts pulled live from the org's tables. We use HEAD requests with
 * `count: "exact"` so we don't pay for the row payload — just the count.
 * Falls back to 0 on error so the UI never crashes.
 */
export function useDashboardMetrics(organizationId: string | null | undefined): DashboardMetrics {
  const [loading, setLoading] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);
  const [newLeads30d, setNewLeads30d] = useState(0);
  const [outreachSent, setOutreachSent] = useState(0);
  const [replies, setReplies] = useState(0);
  const [wonCount, setWonCount] = useState(0);

  const load = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const [{ count: total }, { count: recent }, { count: sent }, { count: rep }, { count: won }] =
        await Promise.all([
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", organizationId),
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .gte("created_at", since),
          supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .in("status", ["sent", "delivered", "opened", "replied"]),
          supabase
            .from("replies")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", organizationId),
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("status", "won"),
        ]);
      setTotalLeads(total ?? 0);
      setNewLeads30d(recent ?? 0);
      setOutreachSent(sent ?? 0);
      setReplies(rep ?? 0);
      setWonCount(won ?? 0);
    } catch (err) {
      console.warn("useDashboardMetrics: failed to load", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;

  return {
    loading,
    totalLeads,
    newLeads30d,
    outreachSent,
    replies,
    conversionRate,
    refresh: load,
  };
}
