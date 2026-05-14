import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ScrollText,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Star,
  Search,
} from "lucide-react";

type AuditRow = {
  id: string;
  hostname: string;
  user_id: string | null;
  event_type: string;
  status: string;
  message: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type ProfileLite = { user_id: string; full_name: string | null };

interface Props {
  organizationId: string | undefined;
  // Bumped by parent whenever a new event is logged so the list refreshes.
  refreshKey?: number;
}

const PAGE_SIZE = 50;

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function eventLabel(type: string): string {
  switch (type) {
    case "added":
      return "Hostname added";
    case "removed":
      return "Hostname removed";
    case "set_primary":
      return "Made primary";
    case "verify_attempt":
      return "Verification attempt";
    case "verify_success":
      return "Verified";
    case "verify_failed":
      return "Verification failed";
    case "dns_lookup_failed":
      return "DNS lookup failed";
    case "auto_verify_started":
      return "Auto-verification started";
    case "auto_verify_stopped":
      return "Auto-verification stopped";
    default:
      return type;
  }
}

function eventIcon(type: string) {
  switch (type) {
    case "added":
      return <Plus className="h-3.5 w-3.5" />;
    case "removed":
      return <Trash2 className="h-3.5 w-3.5" />;
    case "set_primary":
      return <Star className="h-3.5 w-3.5" />;
    case "verify_success":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "verify_attempt":
    case "auto_verify_started":
      return <Search className="h-3.5 w-3.5" />;
    case "verify_failed":
    case "dns_lookup_failed":
    case "auto_verify_stopped":
      return <AlertCircle className="h-3.5 w-3.5" />;
    default:
      return <ScrollText className="h-3.5 w-3.5" />;
  }
}

function statusBadgeVariant(status: string): "secondary" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "success":
      return "secondary";
    case "warning":
      return "warning";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

export function CustomDomainAuditLog({ organizationId, refreshKey }: Props) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [, setNowTick] = useState(0);

  const refresh = async () => {
    if (!organizationId) return;
    setLoading(true);
    setForbidden(false);

    const { data, error } = await supabase
      .from("custom_domain_audit_log")
      .select("id,hostname,user_id,event_type,status,message,details,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    setLoading(false);

    if (error) {
      // RLS will return an empty list rather than an error for non-owners,
      // but treat any explicit error as "not allowed" so we don't show a stack trace.
      setForbidden(true);
      setRows([]);
      return;
    }

    const list = (data ?? []) as AuditRow[];
    setRows(list);

    const userIds = Array.from(
      new Set(list.map((r) => r.user_id).filter((id): id is string => !!id)),
    );
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const map: Record<string, ProfileLite> = {};
      (profileData ?? []).forEach((p) => {
        map[p.user_id] = p as ProfileLite;
      });
      setProfiles(map);
    } else {
      setProfiles({});
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, refreshKey]);

  // Keep "Xs ago" labels fresh.
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          <div>
            <label className="text-sm font-medium text-foreground">Custom Domain Audit Log</label>
            <p className="text-xs text-muted-foreground">
              Every hostname change and verification attempt for this organization, with timestamps.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {forbidden ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-xs text-muted-foreground">
          Only organization owners can view the custom domain audit log.
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-xs text-muted-foreground">
          No domain activity yet. Add a hostname to start the trail.
        </p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {rows.map((row) => {
            const actor = row.user_id ? profiles[row.user_id]?.full_name : null;
            return (
              <div
                key={row.id}
                className="flex gap-3 rounded-lg border border-border bg-secondary/20 p-3"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                  {eventIcon(row.event_type)}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {eventLabel(row.event_type)}
                    </span>
                    <Badge variant={statusBadgeVariant(row.status)} className="text-[10px]">
                      {row.status}
                    </Badge>
                    <code className="text-[11px] font-mono text-muted-foreground">
                      {row.hostname}
                    </code>
                    <span
                      className="ml-auto text-[10px] text-muted-foreground"
                      title={new Date(row.created_at).toLocaleString()}
                    >
                      {formatRelative(row.created_at)}
                    </span>
                  </div>
                  {row.message && (
                    <p className="text-[11px] text-muted-foreground">{row.message}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/80">
                    {actor ? (
                      <>
                        by <span className="text-foreground">{actor}</span>
                      </>
                    ) : row.user_id ? (
                      <>by user {row.user_id.slice(0, 8)}</>
                    ) : (
                      "by system"
                    )}
                    {" · "}
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
          {rows.length === PAGE_SIZE && (
            <p className="pt-1 text-center text-[10px] text-muted-foreground">
              Showing the most recent {PAGE_SIZE} events.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
