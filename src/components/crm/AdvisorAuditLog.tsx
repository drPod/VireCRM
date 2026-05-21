import { useMemo, useState } from "react";
import { Filter, RefreshCw, ScrollText, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { useAdvisorAuditLog } from "@/hooks/useAdvisorAuditLog";
import { useRetentionSettings } from "@/hooks/useRetentionSettings";
import { replayCommandPlanFn } from "@/functions/command-execute.functions";
import type { AdvisorAuditEntry } from "@/functions/advisor-audit.functions";
import { entryStatusMatches } from "@/lib/advisor-audit-utils";
import { AdvisorAuditEntryRow } from "./AdvisorAuditEntryRow";
import { AdvisorAuditFiltersPanel } from "./AdvisorAuditFiltersPanel";
import { AdvisorAuditSettingsPanel } from "./AdvisorAuditSettingsPanel";
import type { PhaseFilter, StatusFilter } from "./advisor-audit.types";

const PHASE_OPTIONS: readonly PhaseFilter[] = ["all", "plan", "execute"] as const;

export function AdvisorAuditLog() {
  const replay = useServerFn(replayCommandPlanFn);
  const { entries, loading, phase, setPhase, retention, memberNames, refresh } =
    useAdvisorAuditLog();
  const {
    retentionInput,
    setRetentionInput,
    savingRetention,
    purging,
    handleSaveRetention,
    handlePurgeNow,
  } = useRetentionSettings({ retention, refresh });

  const [openId, setOpenId] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

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
            {PHASE_OPTIONS.map((p) => (
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
        <AdvisorAuditFiltersPanel
          search={search}
          onSearchChange={setSearch}
          userFilter={userFilter}
          onUserFilterChange={setUserFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          userOptions={userOptions}
          activeFilterCount={activeFilterCount}
          filteredCount={filteredEntries.length}
          totalCount={entries.length}
          onClear={clearFilters}
        />
      )}

      {showSettings && retention && (
        <AdvisorAuditSettingsPanel
          retention={retention}
          retentionInput={retentionInput}
          onRetentionInputChange={setRetentionInput}
          savingRetention={savingRetention}
          purging={purging}
          onSave={handleSaveRetention}
          onPurge={handlePurgeNow}
        />
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
            const userLabel = e.user_id
              ? (memberNames[e.user_id] ?? `${e.user_id.slice(0, 8)}…`)
              : null;
            return (
              <AdvisorAuditEntryRow
                key={e.id}
                entry={e}
                isOpen={openId === e.id}
                onToggle={() => setOpenId(openId === e.id ? null : e.id)}
                userLabel={userLabel}
                isReplaying={replayingId === e.id}
                anyReplaying={replayingId !== null}
                onReplay={() => handleReplay(e)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
