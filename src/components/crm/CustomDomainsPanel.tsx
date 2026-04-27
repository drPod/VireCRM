import { useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuth } from "@/components/auth/AuthProvider";

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

interface Props {
  organizationId: string | undefined;
}

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

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
      // Owner-role members of this org — shown so non-owners know who to ask.
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

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const handleAdd = async () => {
    if (!organizationId) return;
    const clean = newHost.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
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
      return;
    }
    const result = data as { success: boolean; error?: string } | null;
    if (!result?.success) {
      toast.error(result?.error || "Could not add hostname");
      return;
    }
    toast.success("Hostname added — complete DNS verification below");
    setNewHost("");
    void refresh();
  };

  const handleVerify = async (row: DomainRow) => {
    setBusyId(row.id);
    try {
      const lookup = `_vireon.${row.hostname}`;
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(lookup)}&type=TXT`,
        { headers: { Accept: "application/dns-json" } },
      );
      const dns = (await res.json()) as { Answer?: { data: string }[] };
      const records = (dns.Answer || []).map((a) => a.data.replace(/^"|"$/g, ""));
      const matched = records.some((r) => r.includes(row.verification_token));
      if (!matched) {
        toast.error(`No matching TXT record at _vireon.${row.hostname}. DNS can take a few minutes to propagate.`);
        return;
      }
      const { data, error } = await supabase.rpc("mark_custom_domain_verified", {
        p_domain_id: row.id,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || "Verification failed");
      toast.success(`${row.hostname} verified`);
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
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
      return;
    }
    const result = data as { success: boolean; error?: string } | null;
    if (!result?.success) {
      toast.error(result?.error || "Could not set primary");
      return;
    }
    toast.success(`${row.hostname} is now primary`);
    void refresh();
  };

  const handleRemove = async (row: DomainRow) => {
    if (!confirm(`Remove ${row.hostname}? Visitors won't be able to reach the CRM via this hostname anymore.`)) return;
    setBusyId(row.id);
    const { data, error } = await supabase.rpc("remove_custom_domain", {
      p_domain_id: row.id,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { success: boolean; error?: string } | null;
    if (!result?.success) {
      toast.error(result?.error || "Could not remove hostname");
      return;
    }
    toast.success("Hostname removed");
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
              Serve the CRM under one or more hostnames. Each must be verified independently.
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
            Multiple custom hostnames are part of the <strong>Enterprise White-Label add-on</strong>.
            Once enabled, you can connect a primary domain plus any number of aliases.
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
              <Badge variant="outline" className="ml-auto text-[10px]">Owner only</Badge>
            </div>
            {owners.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No owners found for this organization.</p>
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
                Your role can view hostnames but cannot add, verify, remove, or change the primary. Ask an owner above to make changes.
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
              <Button variant="command" onClick={handleAdd} disabled={adding || !newHost.trim()} className="gap-1.5">
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
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
                          <p className="text-[11px] font-semibold text-foreground">Step 1 — Point DNS</p>
                          <p className="text-[11px] text-muted-foreground">
                            Add a CNAME or A record so <code className="text-foreground">{row.hostname}</code> points to this app.
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-foreground">
                            Step 2 — Add TXT at <code className="text-foreground">_vireon.{row.hostname}</code>
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
                        <Button
                          variant="command"
                          size="sm"
                          className="w-full"
                          onClick={() => void handleVerify(row)}
                          disabled={isBusy || !isOwner}
                          title={!isOwner ? "Only owners can verify hostnames" : undefined}
                        >
                          {isBusy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                          {isOwner ? "Verify hostname" : "Verification requires an owner"}
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
