import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lookupTxtToken, TXT_VERIFICATION_PREFIX } from "@/lib/dns-check";
import {
  type AutoState,
  type DomainRow,
  RETRY_DELAYS_MS,
  logEvent,
} from "@/components/crm/custom-domains.types";

interface UseAutoVerifyDomainArgs {
  organizationId: string | undefined;
  isOwner: boolean;
  rows: DomainRow[];
  onRefresh: () => Promise<void> | void;
  onAuditEvent: () => void;
}

interface UseAutoVerifyDomainResult {
  autoState: Record<string, AutoState>;
  setAutoState: React.Dispatch<React.SetStateAction<Record<string, AutoState>>>;
  startAutoVerify: (row: DomainRow, opts?: { silent?: boolean }) => void;
  runAttempt: (row: DomainRow) => Promise<boolean>;
  cancelRow: (id: string) => void;
}

export function useAutoVerifyDomain({
  organizationId,
  isOwner,
  rows,
  onRefresh,
  onAuditEvent,
}: UseAutoVerifyDomainArgs): UseAutoVerifyDomainResult {
  const [autoState, setAutoState] = useState<Record<string, AutoState>>({});

  // Track scheduled timers per-row so we can cancel on unmount/row removal.
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cancelledRef = useRef<Record<string, boolean>>({});

  const clearTimer = useCallback((id: string) => {
    const t = timersRef.current[id];
    if (t) {
      clearTimeout(t);
      delete timersRef.current[id];
    }
  }, []);

  const updateAuto = useCallback((id: string, patch: Partial<AutoState>) => {
    setAutoState((prev) => {
      const current: AutoState = prev[id] ?? {
        status: "idle",
        attempt: 0,
        maxAttempts: RETRY_DELAYS_MS.length,
        nextCheckAt: null,
        lastError: null,
      };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  }, []);

  const cancelRow = useCallback(
    (id: string) => {
      cancelledRef.current[id] = true;
      clearTimer(id);
    },
    [clearTimer],
  );

  // Single attempt: lookup DNS, mark verified server-side on success.
  const runAttempt = useCallback(
    async (row: DomainRow): Promise<boolean> => {
      updateAuto(row.id, { status: "checking", lastError: null });
      if (organizationId) {
        void logEvent({
          orgId: organizationId,
          domainId: row.id,
          hostname: row.hostname,
          eventType: "verify_attempt",
          status: "info",
          message: `Looking up TXT ${TXT_VERIFICATION_PREFIX}.${row.hostname}`,
        }).then(onAuditEvent);
      }
      const { found, error } = await lookupTxtToken(row.hostname, row.verification_token);
      if (!found) {
        updateAuto(row.id, { lastError: error ?? "TXT record not visible yet" });
        if (organizationId) {
          void logEvent({
            orgId: organizationId,
            domainId: row.id,
            hostname: row.hostname,
            eventType: error ? "dns_lookup_failed" : "verify_failed",
            status: error ? "error" : "warning",
            message: error ?? "TXT record not visible yet",
          }).then(onAuditEvent);
        }
        return false;
      }
      const { data, error: rpcErr } = await supabase.rpc("mark_custom_domain_verified", {
        p_domain_id: row.id,
      });
      if (rpcErr) {
        updateAuto(row.id, { lastError: rpcErr.message });
        if (organizationId) {
          void logEvent({
            orgId: organizationId,
            domainId: row.id,
            hostname: row.hostname,
            eventType: "verify_failed",
            status: "error",
            message: rpcErr.message,
          }).then(onAuditEvent);
        }
        return false;
      }
      const result = data as { success: boolean; error?: string } | null;
      if (!result?.success) {
        updateAuto(row.id, { lastError: result?.error ?? "Verification failed" });
        if (organizationId) {
          void logEvent({
            orgId: organizationId,
            domainId: row.id,
            hostname: row.hostname,
            eventType: "verify_failed",
            status: "error",
            message: result?.error ?? "Verification failed",
          }).then(onAuditEvent);
        }
        return false;
      }
      updateAuto(row.id, { status: "verified", nextCheckAt: null, lastError: null });
      if (organizationId) {
        void logEvent({
          orgId: organizationId,
          domainId: row.id,
          hostname: row.hostname,
          eventType: "verify_success",
          status: "success",
          message: `Verified ${row.hostname}`,
        }).then(onAuditEvent);
      }
      return true;
    },
    [organizationId, onAuditEvent, updateAuto],
  );

  // Schedule auto-verification with backoff for a row that's not yet verified.
  const startAutoVerify = useCallback(
    (row: DomainRow, opts?: { silent?: boolean }) => {
      if (!isOwner) return; // Only owners can call mark_custom_domain_verified.
      if (row.verified_at) return;

      cancelledRef.current[row.id] = false;
      clearTimer(row.id);
      updateAuto(row.id, {
        status: "waiting",
        attempt: 0,
        maxAttempts: RETRY_DELAYS_MS.length,
        nextCheckAt: Date.now() + RETRY_DELAYS_MS[0],
        lastError: null,
      });

      if (organizationId) {
        void logEvent({
          orgId: organizationId,
          domainId: row.id,
          hostname: row.hostname,
          eventType: "auto_verify_started",
          status: "info",
          message: `Auto-verification started — up to ${RETRY_DELAYS_MS.length} attempts`,
        }).then(onAuditEvent);
      }

      const attemptAt = (idx: number) => {
        if (cancelledRef.current[row.id]) return;
        const delay = RETRY_DELAYS_MS[idx] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        updateAuto(row.id, {
          status: "waiting",
          attempt: idx,
          nextCheckAt: Date.now() + delay,
        });
        timersRef.current[row.id] = setTimeout(async () => {
          if (cancelledRef.current[row.id]) return;
          const ok = await runAttempt(row);
          if (ok) {
            if (!opts?.silent) toast.success(`${row.hostname} verified`);
            await onRefresh();
            return;
          }
          const nextIdx = idx + 1;
          if (nextIdx >= RETRY_DELAYS_MS.length) {
            updateAuto(row.id, { status: "failed", nextCheckAt: null });
            if (organizationId) {
              void logEvent({
                orgId: organizationId,
                domainId: row.id,
                hostname: row.hostname,
                eventType: "auto_verify_stopped",
                status: "warning",
                message: `Stopped after ${RETRY_DELAYS_MS.length} attempts — DNS still not visible`,
              }).then(onAuditEvent);
            }
            if (!opts?.silent) {
              toast.error(`Couldn't verify ${row.hostname} automatically — DNS still not visible.`);
            }
            return;
          }
          attemptAt(nextIdx);
        }, delay);
      };

      attemptAt(0);
    },
    [isOwner, organizationId, clearTimer, updateAuto, runAttempt, onRefresh, onAuditEvent],
  );

  // Cancel timers/state for rows that no longer exist whenever the row set changes.
  useEffect(() => {
    const liveIds = new Set(rows.map((r) => r.id));
    Object.keys(timersRef.current).forEach((id) => {
      if (!liveIds.has(id)) {
        clearTimer(id);
        cancelledRef.current[id] = true;
      }
    });
    setAutoState((prev) => {
      let changed = false;
      const filtered: Record<string, AutoState> = {};
      Object.entries(prev).forEach(([id, val]) => {
        if (liveIds.has(id)) filtered[id] = val;
        else changed = true;
      });
      return changed ? filtered : prev;
    });
  }, [rows, clearTimer]);

  // Kick off auto-verify for any pending rows the first time they appear.
  // Re-runs whenever rows change (e.g., after add/remove).
  useEffect(() => {
    if (!isOwner) return;
    rows.forEach((row) => {
      if (row.verified_at) return;
      const existing = autoState[row.id];
      if (existing && (existing.status === "checking" || existing.status === "waiting")) return;
      // If we previously failed, don't auto-restart — user can press "Check now".
      if (existing && existing.status === "failed") return;
      startAutoVerify(row, { silent: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, isOwner]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((t) => clearTimeout(t));
      timersRef.current = {};
    };
  }, []);

  return { autoState, setAutoState, startAutoVerify, runAttempt, cancelRow };
}
