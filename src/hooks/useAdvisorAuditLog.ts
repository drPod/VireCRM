import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  listAdvisorAuditFn,
  type AdvisorAuditEntry,
} from "@/functions/advisor-audit.functions";
import {
  getAuditRetentionFn,
  type AuditRetentionInfo,
} from "@/functions/audit-retention.functions";
import type { PhaseFilter } from "@/components/crm/advisor-audit.types";

export interface UseAdvisorAuditLogResult {
  entries: AdvisorAuditEntry[];
  loading: boolean;
  phase: PhaseFilter;
  setPhase: (p: PhaseFilter) => void;
  retention: AuditRetentionInfo | null;
  memberNames: Record<string, string>;
  refresh: () => Promise<void>;
}

export function useAdvisorAuditLog(): UseAdvisorAuditLogResult {
  const { organization } = useAuth();
  const list = useServerFn(listAdvisorAuditFn);
  const getRetention = useServerFn(getAuditRetentionFn);

  const [entries, setEntries] = useState<AdvisorAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<PhaseFilter>("all");
  const [retention, setRetention] = useState<AuditRetentionInfo | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, retInfo] = await Promise.all([
        list({ data: { limit: 50, phase } }),
        getRetention(),
      ]);
      setEntries(rows);
      setRetention(retInfo);
    } finally {
      setLoading(false);
    }
  }, [list, getRetention, phase]);

  // Load member names for the user filter
  useEffect(() => {
    if (!organization?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", organization.id);
      if (data) {
        const map: Record<string, string> = {};
        for (const row of data) {
          map[row.user_id] = row.full_name || row.user_id.slice(0, 8);
        }
        setMemberNames(map);
      }
    })();
  }, [organization?.id]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return { entries, loading, phase, setPhase, retention, memberNames, refresh };
}
