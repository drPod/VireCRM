import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listLeadEmailLogsFn, type EmailLogEntry } from "@/functions/email-log.functions";
import type { Lead } from "@/components/crm/LeadCard";

/**
 * Lazy-loads the Resend send log for a lead. Returns the entries plus a
 * stable `refresh` callback so the caller can re-fetch after sending a new
 * email or via a manual refresh button.
 *
 * `enabled` lets the caller defer the first fetch until the Emails tab is
 * actually opened.
 */
export function useLeadEmailLogs(lead: Lead | null, emailOverride: string, enabled: boolean) {
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);

  const refresh = useCallback(async () => {
    if (!lead) return;
    const email = (emailOverride || lead.email || "").trim();
    if (!email) {
      setEmailLogs([]);
      return;
    }
    setLoadingEmailLogs(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setEmailLogs([]);
        return;
      }
      const rows = await listLeadEmailLogsFn({
        headers: { Authorization: `Bearer ${token}` },
        data: { email },
      });
      // Server functions can wrap responses in different shapes (array, { result }, { data }).
      // Defensively normalize so a non-array response never crashes the render.
      const list: EmailLogEntry[] = Array.isArray(rows)
        ? rows
        : Array.isArray((rows as { result?: unknown })?.result)
          ? (rows as { result: EmailLogEntry[] }).result
          : Array.isArray((rows as { data?: unknown })?.data)
            ? (rows as { data: EmailLogEntry[] }).data
            : [];
      setEmailLogs(list);
    } catch (err) {
      console.error("[useLeadEmailLogs] Failed to load email logs:", err);
      setEmailLogs([]);
    } finally {
      setLoadingEmailLogs(false);
    }
  }, [lead, emailOverride]);

  useEffect(() => {
    if (!lead || !enabled) return;
    void refresh();
  }, [lead, enabled, refresh]);

  return { emailLogs, loadingEmailLogs, refresh };
}
