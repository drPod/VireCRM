import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AssigneeOption } from "@/components/crm/AssigneeMultiSelect";

/**
 * Owner-only: load the org's member roster as `AssigneeOption[]`, sorted by
 * display name. Returns `[]` while disabled or pending — callers don't have
 * to guard the gate themselves.
 */
export function useOrgMembers(organizationId: string | undefined, enabled: boolean) {
  const [members, setMembers] = useState<AssigneeOption[]>([]);

  useEffect(() => {
    if (!organizationId || !enabled) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", organizationId);
      if (cancelled || error || !data) return;
      setMembers(
        data
          .filter((p): p is { user_id: string; full_name: string | null } => Boolean(p.user_id))
          .map((p) => ({ user_id: p.user_id, full_name: p.full_name ?? "Unnamed" }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name)),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, enabled]);

  return members;
}
