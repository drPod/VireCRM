import type { AdvisorAuditEntry } from "@/functions/advisor-audit.functions";
import type { StatusFilter } from "@/components/crm/advisor-audit.types";

/**
 * Advisor-audit-specific relative time. Distinct from `formatRelativeTime`
 * in `date-utils.ts`: seconds granularity, locale-string fallback at 24h
 * (audit entries beyond a day want absolute time, not "2d ago").
 */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleString();
}

export function entryStatusMatches(entry: AdvisorAuditEntry, status: StatusFilter): boolean {
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
