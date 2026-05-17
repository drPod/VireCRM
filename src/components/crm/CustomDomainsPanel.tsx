import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Plus,
  Copy,
  Trash2,
  Star,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Crown,
  Lock,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuth } from "@/components/auth/AuthProvider";
import { CustomDomainAuditLog } from "@/components/crm/CustomDomainAuditLog";
import { DomainHealthPanel } from "@/components/crm/DomainHealthPanel";

// Fire-and-forget audit logger. Failures here must never block the user action,
// so we just log them to the console for ops.
async function logEvent(args: {
  orgId: string;
  domainId: string | null;
  hostname: string;
  eventType:
    | "added"
    | "removed"
    | "set_primary"
    | "verify_attempt"
    | "verify_success"
    | "verify_failed"
    | "dns_lookup_failed"
    | "auto_verify_started"
    | "auto_verify_stopped";
  status: "info" | "success" | "warning" | "error";
  message?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Cast params: generated RPC types treat NULLABLE params as `string` (required)
    // because the SQL signature doesn't carry NULL info into the typegen.
    await supabase.rpc("log_custom_domain_event", {
      p_org_id: args.orgId,
      p_domain_id: args.domainId,
      p_hostname: args.hostname,
      p_event_type: args.eventType,
      p_status: args.status,
      p_message: args.message ?? null,
      p_details: (args.details ?? {}) as never,
    } as never);
  } catch (err) {
    console.warn("[custom-domain audit] failed to log event", err);
  }
}

type DomainRow = {
  id: string;
  hostname: string;
  is_primary: boolean;
  verification_token: string;
  verified_at: string | null;
  created_at: string;
};

type OwnerRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

// Per-row auto-verification state surfaced in the UI.
type AutoState = {
  status: "idle" | "checking" | "waiting" | "verified" | "failed";
  attempt: number;
  maxAttempts: number;
  nextCheckAt: number | null; // epoch ms
  lastError: string | null;
};

interface Props {
  organizationId: string | undefined;
}

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

// Retry schedule (ms) — fast at first while DNS may already be cached, then back off.
const RETRY_DELAYS_MS = [
  3_000, // ~immediate
  7_000, // 10s
  15_000, // 25s
  30_000, // 55s
  60_000, // ~2m
  120_000, // ~4m
  180_000, // ~7m
  300_000, // ~12m
  600_000, // ~22m
];

async function lookupTxt(
  hostname: string,
  token: string,
): Promise<{ found: boolean; error: string | null }> {
  try {
    const lookup = `_majix.${hostname}`;
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(lookup)}&type=TXT`,
      { headers: { Accept: "application/dns-json" } },
    );
    if (!res.ok) return { found: false, error: `DNS lookup failed (${res.status})` };
    const dns = (await res.json()) as { Answer?: { data: string }[] };
    const records = (dns.Answer || []).map((a) => a.data.replace(/^"|"$/g, ""));
    return { found: records.some((r) => r.includes(token)), error: null };
  } catch (err) {
    return { found: false, error: err instanceof Error ? err.message : "DNS lookup failed" };
  }
}

export function CustomDomainsPanel({ organizationId }: Props) {
  const { enabled, loading: flagLoading } = useFeatureFlag("custom_domain");
  const { role } = useAuth();
  const isOwner = role?.role === "owner";
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newHost, setNewHost] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoState, setAutoState] = useState<Record<string, AutoState>>({});
  // Bumped after each logged event so the audit log refreshes immediately.
  const [auditTick, setAuditTick] = useState(0);
  const bumpAudit = () => setAuditTick((n) => n + 1);

  // Track scheduled timers per-row so we can cancel on unmount/row removal.
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cancelledRef = useRef<Record<string, boolean>>({});
  // Tick state to refresh "next check in Xs" countdown labels.
  const [, setNowTick] = useState(0);

  const clearTimer = (id: string) => {
    const t = timersRef.current[id];
    if (t) {
      clearTimeout(t);
      delete timersRef.current[id];
    }
  };

  const updateAuto = (id: string, patch: Partial<AutoState>) => {
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
  };

  const refresh = async () => {
    if (!organizationId) return;
    setLoading(true);
    const [domainsRes, rolesRes] = await Promise.all([
      supabase
        .from("org_custom_domains")
        .select("id,hostname,is_primary,verification_token,verified_at,created_at")
        .eq("organization_id", organizationId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("role", "owner"),
    ]);
    setLoading(false);
    if (domainsRes.error) {
      toast.error(domainsRes.error.message);
      return;
    }
    const next = (domainsRes.data ?? []) as DomainRow[];
    setRows(next);

    // Cancel timers/state for rows that no longer exist.
    const liveIds = new Set(next.map((r) => r.id));
    Object.keys(timersRef.current).forEach((id) => {
      if (!liveIds.has(id)) {
        clearTimer(id);
        cancelledRef.current[id] = true;
      }
    });
    setAutoState((prev) => {
      const filtered: Record<string, AutoState> = {};
      Object.entries(prev).forEach(([id, val]) => {
        if (liveIds.has(id)) filtered[id] = val;
      });
      return filtered;
    });

    const ownerIds = (rolesRes.data ?? []).map((r) => r.user_id);
    if (ownerIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ownerIds);
      const list: OwnerRow[] = ownerIds.map((uid) => {
        const p = (profileRows ?? []).find((row) => row.user_id === uid);
        return { user_id: uid, full_name: p?.full_name ?? null, email: null };
      });
      setOwners(list);
    } else {
      setOwners([]);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Tick once a second so the countdown label stays fresh.
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((t) => clearTimeout(t));
      timersRef.current = {};
    };
  }, []);

  // Single attempt: lookup DNS, mark verified server-side on success.
  const runAttempt = async (row: DomainRow): Promise<boolean> => {
    updateAuto(row.id, { status: "checking", lastError: null });
    if (organizationId) {
      void logEvent({
        orgId: organizationId,
        domainId: row.id,
        hostname: row.hostname,
        eventType: "verify_attempt",
        status: "info",
        message: `Looking up TXT _majix.${row.hostname}`,
      }).then(bumpAudit);
    }
    const { found, error } = await lookupTxt(row.hostname, row.verification_token);
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
        }).then(bumpAudit);
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
        }).then(bumpAudit);
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
        }).then(bumpAudit);
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
      }).then(bumpAudit);
    }
    return true;
  };

  // Schedule auto-verification with backoff for a row that's not yet verified.
  const startAutoVerify = (row: DomainRow, opts?: { silent?: boolean }) => {
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
      }).then(bumpAudit);
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
          await refresh();
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
            }).then(bumpAudit);
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
  };

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

  const handleAdd = async () => {
    if (!organizationId) return;
    const clean = newHost
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!HOSTNAME_RE.test(clean)) {
      toast.error("Enter a valid hostname like crm.yourbrand.com");
      return;
    }
    setAdding(true);
    const { data, error } = await supabase.rpc("add_custom_domain", {
      p_org_id: organizationId,
      p_hostname: clean,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      void logEvent({
        orgId: organizationId,
        domainId: null,
        hostname: clean,
        eventType: "added",
        status: "error",
        message: error.message,
      }).then(bumpAudit);
      return;
    }
    const result = data as { success: boolean; error?: string; id?: string } | null;
    if (!result?.success) {
      toast.error(result?.error || "Could not add hostname");
      void logEvent({
        orgId: organizationId,
        domainId: null,
        hostname: clean,
        eventType: "added",
        status: "error",
        message: result?.error || "Could not add hostname",
      }).then(bumpAudit);
      return;
    }
    toast.success("Hostname added — we'll keep checking DNS automatically");
    void logEvent({
      orgId: organizationId,
      domainId: result.id ?? null,
      hostname: clean,
      eventType: "added",
      status: "success",
      message: `Added ${clean}`,
    }).then(bumpAudit);
    setNewHost("");
    void refresh();
  };

  // Manual "Check now" — run an immediate attempt and (re)start the schedule.
  const handleVerifyNow = async (row: DomainRow) => {
    setBusyId(row.id);
    cancelledRef.current[row.id] = true;
    clearTimer(row.id);
    try {
      const ok = await runAttempt(row);
      if (ok) {
        toast.success(`${row.hostname} verified`);
        await refresh();
        return;
      }
      toast.error(`No matching TXT record yet at _majix.${row.hostname}. We'll keep checking.`);
      startAutoVerify(row, { silent: true });
    } finally {
      setBusyId(null);
    }
  };

  const handleSetPrimary = async (row: DomainRow) => {
    setBusyId(row.id);
    const { data, error } = await supabase.rpc("set_primary_custom_domain", {
      p_domain_id: row.id,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      if (organizationId) {
        void logEvent({
          orgId: organizationId,
          domainId: row.id,
          hostname: row.hostname,
          eventType: "set_primary",
          status: "error",
          message: error.message,
        }).then(bumpAudit);
      }
      return;
    }
    const result = data as { success: boolean; error?: string } | null;
    if (!result?.success) {
      toast.error(result?.error || "Could not set primary");
      if (organizationId) {
        void logEvent({
          orgId: organizationId,
          domainId: row.id,
          hostname: row.hostname,
          eventType: "set_primary",
          status: "error",
          message: result?.error || "Could not set primary",
        }).then(bumpAudit);
      }
      return;
    }
    toast.success(`${row.hostname} is now primary`);
    if (organizationId) {
      void logEvent({
        orgId: organizationId,
        domainId: row.id,
        hostname: row.hostname,
        eventType: "set_primary",
        status: "success",
        message: `${row.hostname} promoted to primary`,
      }).then(bumpAudit);
    }
    void refresh();
  };

  const handleRemove = async (row: DomainRow) => {
    if (
      !confirm(
        `Remove ${row.hostname}? Visitors won't be able to reach the CRM via this hostname anymore.`,
      )
    )
      return;
    setBusyId(row.id);
    cancelledRef.current[row.id] = true;
    clearTimer(row.id);
    const { data, error } = await supabase.rpc("remove_custom_domain", {
      p_domain_id: row.id,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      if (organizationId) {
        void logEvent({
          orgId: organizationId,
          domainId: row.id,
          hostname: row.hostname,
          eventType: "removed",
          status: "error",
          message: error.message,
        }).then(bumpAudit);
      }
      return;
    }
    const result = data as { success: boolean; error?: string } | null;
    if (!result?.success) {
      toast.error(result?.error || "Could not remove hostname");
      if (organizationId) {
        void logEvent({
          orgId: organizationId,
          domainId: row.id,
          hostname: row.hostname,
          eventType: "removed",
          status: "error",
          message: result?.error || "Could not remove hostname",
        }).then(bumpAudit);
      }
      return;
    }
    toast.success("Hostname removed");
    if (organizationId) {
      // FK is ON DELETE SET NULL so the audit row is preserved without the domain ref.
      void logEvent({
        orgId: organizationId,
        domainId: null,
        hostname: row.hostname,
        eventType: "removed",
        status: "success",
        message: `Removed ${row.hostname}`,
      }).then(bumpAudit);
    }
    void refresh();
  };

  const renderAutoStatus = (row: DomainRow) => {
    const s = autoState[row.id];
    if (!s) return null;
    if (s.status === "checking") {
      return (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking DNS for <code className="text-foreground">_majix.{row.hostname}</code>…
        </div>
      );
    }
    if (s.status === "waiting" && s.nextCheckAt) {
      const remainingSec = Math.max(0, Math.ceil((s.nextCheckAt - Date.now()) / 1000));
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Auto-checking — next attempt in {remainingSec}s
            <span className="text-muted-foreground/70">
              (attempt {Math.min(s.attempt + 1, s.maxAttempts)}/{s.maxAttempts})
            </span>
          </div>
          {s.lastError && (
            <p className="text-[11px] text-muted-foreground/80">Last check: {s.lastError}</p>
          )}
        </div>
      );
    }
    if (s.status === "failed") {
      return (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3" />
          <div>
            Auto-verification stopped after {s.maxAttempts} attempts.
            {s.lastError ? ` Last error: ${s.lastError}.` : ""} Add the TXT record at{" "}
            <code className="text-destructive">_majix.{row.hostname}</code>, then click{" "}
            <strong>Check now</strong>.
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <div>
            <label className="text-sm font-medium text-foreground">Custom Hostnames</label>
            <p className="text-xs text-muted-foreground">
              Serve the CRM under one or more hostnames. We'll auto-verify DNS once you add the TXT
              record.
            </p>
          </div>
        </div>
        {!flagLoading && !enabled && (
          <Badge variant="warning" className="gap-1">
            <Crown className="h-3 w-3" />
            Add-on required
          </Badge>
        )}
      </div>

      {!flagLoading && !enabled ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
          <p className="text-xs text-foreground">
            Multiple custom hostnames are part of the <strong>Enterprise White-Label add-on</strong>
            . Once enabled, you can connect a primary domain plus any number of aliases.
          </p>
        </div>
      ) : (
        <>
          {/* Who can edit — surfaces the role-based restriction */}
          <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              {isOwner ? (
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span>Allowed to edit hostnames</span>
              <Badge variant="outline" className="ml-auto text-[10px]">
                Owner only
              </Badge>
            </div>
            {owners.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No owners found for this organization.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {owners.map((o) => (
                  <Badge key={o.user_id} variant="secondary" className="text-[11px] font-normal">
                    {o.full_name || o.user_id.slice(0, 8)}
                  </Badge>
                ))}
              </div>
            )}
            {!isOwner && (
              <p className="text-[11px] text-muted-foreground">
                Your role can view hostnames but cannot add, verify, remove, or change the primary.
                Ask an owner above to make changes.
              </p>
            )}
          </div>

          {/* Add new hostname — owner only */}
          {isOwner && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newHost}
                onChange={(e) => setNewHost(e.target.value)}
                placeholder="crm.yourbrand.com"
                className="h-10 flex-1 rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAdd();
                }}
              />
              <Button
                variant="command"
                onClick={handleAdd}
                disabled={adding || !newHost.trim()}
                className="gap-1.5"
              >
                {adding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add
              </Button>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-xs text-muted-foreground">
              No hostnames yet. Add one above to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const verified = !!row.verified_at;
                const isBusy = busyId === row.id;
                const auto = autoState[row.id];
                const isAutoChecking =
                  !verified && (auto?.status === "checking" || auto?.status === "waiting");
                return (
                  <div
                    key={row.id}
                    className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-sm font-mono text-foreground">{row.hostname}</code>
                      {row.is_primary && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          Primary
                        </Badge>
                      )}
                      {verified ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified
                        </Badge>
                      ) : isAutoChecking ? (
                        <Badge variant="outline" className="gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Auto-verifying
                        </Badge>
                      ) : auto?.status === "failed" ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Verification failed
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                      {isOwner && (
                        <div className="ml-auto flex gap-1.5">
                          {verified && !row.is_primary && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleSetPrimary(row)}
                              disabled={isBusy}
                              className="gap-1.5"
                            >
                              <Star className="h-3.5 w-3.5" />
                              Set primary
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRemove(row)}
                            disabled={isBusy}
                            className="gap-1.5 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>

                    {!verified && (
                      <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
                        <div>
                          <p className="text-[11px] font-semibold text-foreground">
                            Step 1 — Point DNS
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Add a CNAME or A record so{" "}
                            <code className="text-foreground">{row.hostname}</code> points to this
                            app.
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-foreground">
                            Step 2 — Add TXT at{" "}
                            <code className="text-foreground">_majix.{row.hostname}</code>
                          </p>
                          <div className="mt-1 flex gap-2">
                            <input
                              readOnly
                              value={row.verification_token}
                              className="h-8 flex-1 rounded-md border border-input bg-input px-2 text-[11px] font-mono text-foreground outline-none"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                void navigator.clipboard.writeText(row.verification_token);
                                toast.success("Token copied");
                              }}
                              className="gap-1.5"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </Button>
                          </div>
                        </div>

                        {renderAutoStatus(row)}

                        <Button
                          variant="command"
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => void handleVerifyNow(row)}
                          disabled={isBusy || !isOwner}
                          title={!isOwner ? "Only owners can verify hostnames" : undefined}
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          {!isOwner
                            ? "Verification requires an owner"
                            : isAutoChecking
                              ? "Check now"
                              : auto?.status === "failed"
                                ? "Retry verification"
                                : "Check now"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CustomDomainsSection({ organizationId }: Props) {
  return (
    <div className="space-y-4">
      <CustomDomainsPanel organizationId={organizationId} />
      <DomainHealthPanel organizationId={organizationId} />
      <CustomDomainAuditLog organizationId={organizationId} />
    </div>
  );
}
