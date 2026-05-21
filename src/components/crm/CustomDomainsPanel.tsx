import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Globe, Loader2, Crown, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuth } from "@/components/auth/AuthProvider";
import { useServerFn } from "@tanstack/react-start";
import { useConfirm } from "@/hooks/useConfirm";
import { useAutoVerifyDomain } from "@/hooks/useAutoVerifyDomain";
import { CustomDomainAuditLog } from "@/components/crm/CustomDomainAuditLog";
import { DomainHealthPanel } from "@/components/crm/DomainHealthPanel";
import { DomainAddForm } from "@/components/crm/DomainAddForm";
import { DomainListRow } from "@/components/crm/DomainListRow";
import { tearDownCustomHostnameFn } from "@/functions/custom-hostnames.functions";
import { isNotConfigured, describeError } from "@/lib/cf-saas-errors";
import { TXT_VERIFICATION_PREFIX } from "@/lib/dns-check";
import { type DomainRow, type OwnerRow, logEvent } from "@/components/crm/custom-domains.types";

interface Props {
  organizationId: string | undefined;
}

export function CustomDomainsPanel({ organizationId }: Props) {
  const { enabled, loading: flagLoading } = useFeatureFlag("custom_domain");
  const { role } = useAuth();
  const isOwner = role?.role === "owner";
  const tearDownCf = useServerFn(tearDownCustomHostnameFn);
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Bumped after each logged event so the audit log refreshes immediately.
  const [, setAuditTick] = useState(0);
  const bumpAudit = () => setAuditTick((n) => n + 1);

  // Tick state to refresh "next check in Xs" countdown labels.
  const [, setNowTick] = useState(0);

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
    setRows((domainsRes.data ?? []) as DomainRow[]);

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

  const { autoState, startAutoVerify, runAttempt, cancelRow } = useAutoVerifyDomain({
    organizationId,
    isOwner,
    rows,
    onRefresh: refresh,
    onAuditEvent: bumpAudit,
  });

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Tick once a second so the countdown label stays fresh.
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Manual "Check now" — run an immediate attempt and (re)start the schedule.
  const handleVerifyNow = async (row: DomainRow) => {
    setBusyId(row.id);
    cancelRow(row.id);
    try {
      const ok = await runAttempt(row);
      if (ok) {
        toast.success(`${row.hostname} verified`);
        await refresh();
        return;
      }
      toast.error(
        `No matching TXT record yet at ${TXT_VERIFICATION_PREFIX}.${row.hostname}. We'll keep checking.`,
      );
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
    const ok = await confirm({
      title: `Remove ${row.hostname}?`,
      description: "Visitors won't be able to reach the CRM via this hostname anymore.",
      confirmLabel: "Remove hostname",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(row.id);
    cancelRow(row.id);

    // Tear down on Cloudflare BEFORE we remove the local row — once
    // org_custom_domains.id is gone, the server fn can no longer locate the
    // cf_hostname_id needed to call DELETE on the CF API. Best-effort: 503 is
    // silent (CF never configured); other failures surface a toast but we
    // proceed with the local removal so the user isn't blocked.
    if (organizationId) {
      try {
        await tearDownCf({ data: { organizationId, hostname: row.hostname } });
      } catch (err) {
        if (!isNotConfigured(err)) {
          toast.error(`Couldn't tear down on Cloudflare: ${describeError(err)}`);
        }
      }
    }

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
          {isOwner && organizationId && (
            <DomainAddForm
              organizationId={organizationId}
              onAdded={() => void refresh()}
              onAuditEvent={bumpAudit}
            />
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
              {rows.map((row) => (
                <DomainListRow
                  key={row.id}
                  row={row}
                  auto={autoState[row.id]}
                  isBusy={busyId === row.id}
                  isOwner={isOwner}
                  onSetPrimary={(r) => void handleSetPrimary(r)}
                  onRemove={(r) => void handleRemove(r)}
                  onVerifyNow={(r) => void handleVerifyNow(r)}
                />
              ))}
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
