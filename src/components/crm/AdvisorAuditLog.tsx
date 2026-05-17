import { useEffect, useMemo, useState } from "react";
import {
  ScrollText,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  CircleDashed,
  Workflow,
  Brain,
  Play,
  RefreshCw,
  Repeat2,
  Loader2,
  Settings2,
  Trash2,
  Save,
  Search,
  X,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { listAdvisorAuditFn, type AdvisorAuditEntry } from "@/functions/advisor-audit.functions";
import { replayCommandPlanFn } from "@/functions/command-execute.functions";
import {
  getAuditRetentionFn,
  updateAuditRetentionFn,
  purgeAuditLogNowFn,
  type AuditRetentionInfo,
} from "@/functions/audit-retention.functions";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleString();
}

type StatusFilter = "all" | "success" | "errors" | "skipped";

function entryStatusMatches(entry: AdvisorAuditEntry, status: StatusFilter): boolean {
  if (status === "all") return true;
  if (status === "errors") return entry.error_count > 0 || !!entry.error_message;
  if (status === "skipped") return entry.skipped_count > 0;
  // success
  return (
    entry.error_count === 0 &&
    !entry.error_message &&
    entry.phase === "execute" &&
    entry.ok_count > 0
  );
}

export function AdvisorAuditLog() {
  const { organization } = useAuth();
  const list = useAuthedServerFn(listAdvisorAuditFn);
  const replay = useAuthedServerFn(replayCommandPlanFn);
  const getRetention = useAuthedServerFn(getAuditRetentionFn);
  const updateRetention = useAuthedServerFn(updateAuditRetentionFn);
  const purgeNow = useAuthedServerFn(purgeAuditLogNowFn);
  const [entries, setEntries] = useState<AdvisorAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"all" | "plan" | "execute">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [retention, setRetention] = useState<AuditRetentionInfo | null>(null);
  const [retentionInput, setRetentionInput] = useState<string>("90");
  const [savingRetention, setSavingRetention] = useState(false);
  const [purging, setPurging] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const refresh = async () => {
    setLoading(true);
    try {
      const [rows, retInfo] = await Promise.all([
        list({ data: { limit: 50, phase } }),
        getRetention(),
      ]);
      setEntries(rows);
      setRetention(retInfo);
      setRetentionInput(String(retInfo.retention_days));
    } finally {
      setLoading(false);
    }
  };

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

  const handleSaveRetention = async () => {
    const days = parseInt(retentionInput, 10);
    if (Number.isNaN(days) || days < 0 || days > 3650) {
      toast.error("Enter a number between 0 and 3650");
      return;
    }
    setSavingRetention(true);
    try {
      await updateRetention({ data: { retention_days: days } });
      toast.success(
        days === 0
          ? "Retention disabled — entries will be kept forever"
          : `Saved — entries older than ${days} day${days === 1 ? "" : "s"} will be purged`,
      );
      await refresh();
    } catch (e) {
      toast.error("Could not save retention", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSavingRetention(false);
    }
  };

  const handlePurgeNow = async () => {
    setPurging(true);
    try {
      const res = await purgeNow();
      toast.success(`Purged ${res.deleted} old entr${res.deleted === 1 ? "y" : "ies"}`);
      await refresh();
    } catch (e) {
      toast.error("Purge failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setPurging(false);
    }
  };

  const handleReplay = async (entry: AdvisorAuditEntry) => {
    setReplayingId(entry.id);
    try {
      const res = await replay({ data: { audit_id: entry.id } });
      const ok = res.results.filter((r) => r.status === "ok").length;
      const err = res.results.filter((r) => r.status === "error").length;
      if (err > 0) {
        toast.warning(`Replay finished with ${err} error${err === 1 ? "" : "s"}`, {
          description: `${ok} succeeded · ${err} failed`,
        });
      } else {
        toast.success("Replay complete", {
          description: `${ok} action${ok === 1 ? "" : "s"} re-executed`,
        });
      }
      await refresh();
    } catch (e) {
      toast.error("Replay failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setReplayingId(null);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Build user options from entries + known members
  const userOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const e of entries) {
      if (e.user_id) ids.add(e.user_id);
    }
    return Array.from(ids).map((id) => ({
      id,
      name: memberNames[id] ?? `${id.slice(0, 8)}…`,
    }));
  }, [entries, memberNames]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    // dateTo is inclusive end-of-day
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;

    return entries.filter((e) => {
      if (q) {
        const hay = `${e.command} ${e.summary ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (userFilter !== "all" && e.user_id !== userFilter) return false;
      if (!entryStatusMatches(e, statusFilter)) return false;
      const ts = new Date(e.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  }, [entries, search, userFilter, statusFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    return filteredEntries.reduce(
      (acc, e) => {
        acc.total += 1;
        if (e.phase === "execute") {
          acc.executions += 1;
          acc.ok += e.ok_count;
          acc.err += e.error_count;
        }
        return acc;
      },
      { total: 0, executions: 0, ok: 0, err: 0 },
    );
  }, [filteredEntries]);

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (userFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setUserFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/40 px-5 py-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Advisor Audit Log</span>
          <Badge variant="secondary" className="text-[10px]">
            {stats.total}
            {activeFilterCount > 0 ? ` / ${entries.length}` : ""} entries
          </Badge>
          {stats.executions > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {stats.ok} ok · {stats.err} err
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border bg-background overflow-hidden text-xs">
            {(["all", "plan", "execute"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPhase(p)}
                className={`px-2.5 py-1 transition-colors ${
                  phase === p
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            title="Search & filters"
            className="relative"
          >
            <Filter className="h-3.5 w-3.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings((v) => !v)}
            title="Retention settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="border-b border-border bg-background/30 px-5 py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search command text or summary…"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              className="h-8 text-sm pl-8 pr-8"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground">User</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {userOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="success">Success only</SelectItem>
                  <SelectItem value="errors">With errors</SelectItem>
                  <SelectItem value="skipped">With skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(ev) => setDateFrom(ev.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(ev) => setDateTo(ev.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground">
                Showing {filteredEntries.length} of {entries.length} entries
              </span>
              <Button size="sm" variant="ghost" onClick={clearFilters} className="h-7 text-xs">
                <X className="h-3 w-3 mr-1" />
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}

      {showSettings && retention && (
        <div className="border-b border-border bg-background/30 px-5 py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="retention-days" className="text-xs font-semibold">
                Retention period (days)
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                Entries older than this are purged automatically each day. Use{" "}
                <span className="font-mono">0</span> to keep entries forever (max 3650).
              </p>
              <Input
                id="retention-days"
                type="number"
                min={0}
                max={3650}
                value={retentionInput}
                onChange={(ev) => setRetentionInput(ev.target.value)}
                disabled={!retention.is_owner || savingRetention}
                className="h-8 text-sm max-w-[140px]"
              />
            </div>
            <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              <span>Total entries: {retention.total_entries}</span>
              <span>
                Oldest:{" "}
                {retention.oldest_entry
                  ? new Date(retention.oldest_entry).toLocaleDateString()
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePurgeNow}
                disabled={!retention.is_owner || purging || retention.retention_days === 0}
                className="h-8"
              >
                {purging ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5 text-xs">Purge now</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRetention}
                disabled={
                  !retention.is_owner ||
                  savingRetention ||
                  retentionInput === String(retention.retention_days)
                }
                className="h-8"
              >
                {savingRetention ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5 text-xs">Save</span>
              </Button>
            </div>
          </div>
          {!retention.is_owner && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Only organization owners can change retention.
            </p>
          )}
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="px-5 py-6 text-sm text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="px-5 py-6 text-sm text-muted-foreground">
          No Advisor activity yet. Run a command from the Command Bar above to see plans, workflow
          runs, and CRM updates here.
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="px-5 py-6 text-sm text-muted-foreground flex items-center justify-between">
          <span>No entries match your filters.</span>
          <Button size="sm" variant="ghost" onClick={clearFilters} className="h-7 text-xs">
            <X className="h-3 w-3 mr-1" />
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filteredEntries.map((e) => {
            const isOpen = openId === e.id;
            const PhaseIcon = e.phase === "plan" ? Brain : Play;
            const handlers = (e.handlers ?? null) as Record<string, number> | null;
            const n8nCount = handlers?.n8n ?? 0;
            const userLabel = e.user_id
              ? (memberNames[e.user_id] ?? `${e.user_id.slice(0, 8)}…`)
              : null;
            return (
              <li key={e.id} className="px-5 py-3">
                <button
                  onClick={() => setOpenId(isOpen ? null : e.id)}
                  className="w-full flex items-start gap-3 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                  )}
                  <PhaseIcon
                    className={`h-4 w-4 mt-1 shrink-0 ${
                      e.phase === "plan" ? "text-primary" : "text-success"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {e.command}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {e.phase}
                      </Badge>
                      {e.phase === "execute" && (
                        <>
                          {e.ok_count > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-success">
                              <CheckCircle2 className="h-3 w-3" />
                              {e.ok_count}
                            </span>
                          )}
                          {e.error_count > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                              <XCircle className="h-3 w-3" />
                              {e.error_count}
                            </span>
                          )}
                          {e.skipped_count > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <CircleDashed className="h-3 w-3" />
                              {e.skipped_count}
                            </span>
                          )}
                          {n8nCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                              <Workflow className="h-3 w-3" />
                              {n8nCount} n8n
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {e.summary && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.summary}</p>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {timeAgo(e.created_at)} · {e.duration_ms}ms
                      {userLabel ? ` · ${userLabel}` : ""}
                      {e.error_message ? ` · ${e.error_message}` : ""}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 ml-7 space-y-3">
                    {e.phase === "execute" && Array.isArray(e.results) && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                          CRM updates
                        </div>
                        <ul className="space-y-1">
                          {(e.results as Array<Record<string, unknown>>).map((r, i) => (
                            <li
                              key={`${e.id}-${i}`}
                              className="text-xs text-foreground bg-background/40 border border-border rounded-md px-2.5 py-1.5"
                            >
                              <span className="text-muted-foreground mr-2">
                                {String(r.type ?? "?")} · {String(r.status ?? "?")}
                                {r.handler === "n8n" ? " · n8n" : ""}
                              </span>
                              {String(r.message ?? "")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {e.plan != null && (
                      <>
                        {(() => {
                          const planObj = e.plan as { actions?: unknown[] } | null;
                          const actionCount = Array.isArray(planObj?.actions)
                            ? planObj.actions.length
                            : 0;
                          if (actionCount === 0) return null;
                          const isReplaying = replayingId === e.id;
                          return (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReplay(e)}
                                disabled={isReplaying || replayingId !== null}
                                className="h-7 text-xs"
                              >
                                {isReplaying ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Repeat2 className="h-3 w-3" />
                                )}
                                <span className="ml-1.5">
                                  {isReplaying ? "Replaying…" : "Replay this command"}
                                </span>
                              </Button>
                              <span className="text-[11px] text-muted-foreground">
                                Re-runs {actionCount} action
                                {actionCount === 1 ? "" : "s"} with the same guardrails
                              </span>
                            </div>
                          );
                        })()}
                        <details className="group">
                          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            JSON plan
                          </summary>
                          <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-background/60 p-2 text-[11px] text-foreground">
                            {JSON.stringify(e.plan, null, 2)}
                          </pre>
                        </details>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
