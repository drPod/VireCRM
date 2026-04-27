import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Route as RouteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  checkDomainHealth,
  type DomainHealthIssue,
  type DomainHealthResult,
} from "@/functions/domain-health.functions";

// Lovable hosting A-record target. Documented in the custom-domain setup flow.
const LOVABLE_A_RECORD = "185.158.133.1";

interface Props {
  organizationId: string | undefined;
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Couldn't copy — copy manually");
  }
}

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}


interface Props {
  organizationId: string | undefined;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 5_000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

function StatusBadge({ result }: { result: DomainHealthResult }) {
  if (result.ok) {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Healthy
      </Badge>
    );
  }
  const hasError = result.issues.some((i) => i.severity === "error");
  return (
    <Badge variant={hasError ? "destructive" : "warning"} className="gap-1">
      {hasError ? <AlertCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {hasError ? "Unhealthy" : "Warnings"}
    </Badge>
  );
}

export function DomainHealthPanel({ organizationId }: Props) {
  const runCheck = useAuthedServerFn(checkDomainHealth);
  const [results, setResults] = useState<DomainHealthResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [, setNowTick] = useState(0);

  // Tick once a minute so "Xs ago" stays accurate.
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = (await runCheck({ data: { organizationId } })) as {
        ok: boolean;
        results: DomainHealthResult[];
      };
      setResults(res.results ?? []);
      setLastRunAt(new Date().toISOString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Health check failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [organizationId, runCheck]);

  // Auto-run once on mount so users see status without clicking.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allHealthy = results !== null && results.length > 0 && results.every((r) => r.ok);
  const hasErrors = results?.some((r) => r.issues.some((i) => i.severity === "error")) ?? false;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div>
            <label className="text-sm font-medium text-foreground">
              SSL & Route Health
            </label>
            <p className="text-xs text-muted-foreground">
              Live HTTPS probes for every verified hostname. We check certificate validity, the response code, and that the page actually loads this CRM.
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

      {/* Summary banner */}
      {results !== null && results.length > 0 && (
        <div
          className={
            allHealthy
              ? "flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400"
              : hasErrors
                ? "flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                : "flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
          }
        >
          {allHealthy ? (
            <ShieldCheck className="h-4 w-4 shrink-0" />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">
            {allHealthy
              ? `All ${results.length} hostname${results.length === 1 ? "" : "s"} responding correctly over HTTPS.`
              : hasErrors
                ? `${results.filter((r) => !r.ok).length} of ${results.length} hostnames need attention.`
                : `Hostnames are reachable but ${results.filter((r) => r.issues.length > 0).length} have warnings.`}
          </span>
          {lastRunAt && (
            <span className="text-[11px] opacity-80">checked {formatRelative(lastRunAt)}</span>
          )}
        </div>
      )}

      {/* List */}
      {loading && results === null ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : results === null ? null : results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-xs text-muted-foreground">
          No verified hostnames yet. Add and verify a hostname above, then come back here to monitor it.
        </p>
      ) : (
        <div className="space-y-3">
          {results.map((r) => (
            <div
              key={r.domainId}
              className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <code className="text-sm font-mono text-foreground">{r.hostname}</code>
                <StatusBadge result={r} />
                {r.httpStatus !== null && (
                  <Badge variant="outline" className="text-[10px]">
                    HTTP {r.httpStatus}
                  </Badge>
                )}
                {r.responseMs !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    {r.responseMs}ms
                  </span>
                )}
              </div>

              {/* Check matrix */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <CheckPill
                  label="HTTPS"
                  ok={r.httpsReachable}
                  failLabel="Unreachable"
                />
                <CheckPill
                  label="SSL"
                  ok={r.sslValid}
                  failLabel="Invalid cert"
                />
                <CheckPill
                  label="Status"
                  ok={r.httpStatus !== null && r.httpStatus < 400}
                  failLabel={r.httpStatus ? `HTTP ${r.httpStatus}` : "No response"}
                />
                <CheckPill
                  label="Serves this app"
                  ok={r.servesThisApp}
                  failLabel="Wrong content"
                />
              </div>

              {/* Issues */}
              {r.issues.length > 0 && (
                <div className="space-y-1.5">
                  {r.issues.map((issue, idx) => {
                    const isError = issue.severity === "error";
                    return (
                      <div
                        key={idx}
                        className={
                          isError
                            ? "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive"
                            : "flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400"
                        }
                      >
                        {isError ? (
                          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        )}
                        <div className="space-y-0.5">
                          <p className="font-medium">{issue.message}</p>
                          {issue.hint && <p className="opacity-80">{issue.hint}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {r.redirected && r.finalUrl && (
                <p className="text-[11px] text-muted-foreground">
                  Final URL: <code className="text-foreground">{r.finalUrl}</code>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckPill({
  label,
  ok,
  failLabel,
}: {
  label: string;
  ok: boolean;
  failLabel: string;
}) {
  return (
    <div
      className={
        ok
          ? "flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-400"
          : "flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive"
      }
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3 shrink-0" />
      ) : (
        <AlertCircle className="h-3 w-3 shrink-0" />
      )}
      <span className="font-medium">{label}</span>
      {!ok && <span className="opacity-80">· {failLabel}</span>}
    </div>
  );
}
