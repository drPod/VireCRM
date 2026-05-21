import { useState } from "react";
import { Activity, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { useDomainHealthCheck } from "@/hooks/useDomainHealthCheck";
import { pollCustomHostnameStatusFn } from "@/functions/custom-hostnames.functions";
import type { DomainHealthResult } from "@/functions/domain-health.functions";
import { formatRelativeTime } from "@/lib/date-utils";
import { DomainHealthRedirectGuide } from "./DomainHealthRedirectGuide";
import { DomainHealthRow } from "./DomainHealthRow";

interface Props {
  organizationId: string | undefined;
}

export function DomainHealthPanel({ organizationId }: Props) {
  const pollCf = useServerFn(pollCustomHostnameStatusFn);
  const { results, loading, lastRunAt, refresh } = useDomainHealthCheck(organizationId);
  const [redirectGuide, setRedirectGuide] = useState<DomainHealthResult | null>(null);

  const allHealthy = results !== null && results.length > 0 && results.every((r) => r.ok);
  const hasErrors = results?.some((r) => r.issues.some((i) => i.severity === "error")) ?? false;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div>
            <label className="text-sm font-medium text-foreground">SSL & Route Health</label>
            <p className="text-xs text-muted-foreground">
              Live HTTPS probes for every verified hostname. We check certificate validity, the
              response code, and that the page actually loads this CRM.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading || !organizationId}
          className="gap-1.5 shrink-0"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {loading ? "Checking…" : "Re-check"}
        </Button>
      </div>

      {results !== null && results.length > 0 && (
        <SummaryBanner
          results={results}
          allHealthy={allHealthy}
          hasErrors={hasErrors}
          lastRunAt={lastRunAt}
        />
      )}

      {loading && results === null ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : results === null ? null : results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-xs text-muted-foreground">
          No verified hostnames yet. Add and verify a hostname above, then come back here to monitor
          it.
        </p>
      ) : (
        <div className="space-y-3">
          {results.map((r) => (
            <DomainHealthRow
              key={r.domainId}
              result={r}
              organizationId={organizationId}
              pollCf={pollCf}
              onShowRedirectGuide={setRedirectGuide}
            />
          ))}
        </div>
      )}

      <DomainHealthRedirectGuide result={redirectGuide} onClose={() => setRedirectGuide(null)} />
    </div>
  );
}

function SummaryBanner({
  results,
  allHealthy,
  hasErrors,
  lastRunAt,
}: {
  results: DomainHealthResult[];
  allHealthy: boolean;
  hasErrors: boolean;
  lastRunAt: string | null;
}) {
  const className = allHealthy
    ? "flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400"
    : hasErrors
      ? "flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      : "flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400";

  const message = allHealthy
    ? `All ${results.length} hostname${results.length === 1 ? "" : "s"} responding correctly over HTTPS.`
    : hasErrors
      ? `${results.filter((r) => !r.ok).length} of ${results.length} hostnames need attention.`
      : `Hostnames are reachable but ${results.filter((r) => r.issues.length > 0).length} have warnings.`;

  return (
    <div className={className}>
      {allHealthy ? (
        <ShieldCheck className="h-4 w-4 shrink-0" />
      ) : (
        <ShieldAlert className="h-4 w-4 shrink-0" />
      )}
      <span className="flex-1">{message}</span>
      {lastRunAt && (
        <span className="text-[11px] opacity-80">checked {formatRelativeTime(lastRunAt)}</span>
      )}
    </div>
  );
}
