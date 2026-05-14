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
  const [redirectGuide, setRedirectGuide] = useState<DomainHealthResult | null>(null);
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
          No verified hostnames yet. Add and verify a hostname above, then come back here to monitor
          it.
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
                  <span className="text-[11px] text-muted-foreground">{r.responseMs}ms</span>
                )}
              </div>

              {/* Check matrix */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <CheckPill label="HTTPS" ok={r.httpsReachable} failLabel="Unreachable" />
                <CheckPill label="SSL" ok={r.sslValid} failLabel="Invalid cert" />
                <CheckPill
                  label="Status"
                  ok={r.httpStatus !== null && r.httpStatus < 400}
                  failLabel={r.httpStatus ? `HTTP ${r.httpStatus}` : "No response"}
                />
                <CheckPill label="Serves this app" ok={r.servesThisApp} failLabel="Wrong content" />
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
                            ? "rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive"
                            : "rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400"
                        }
                      >
                        <div className="flex items-start gap-2">
                          {isError ? (
                            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                          ) : (
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          )}
                          <div className="space-y-0.5 flex-1">
                            <p className="font-medium">{issue.message}</p>
                            {issue.hint && <p className="opacity-80">{issue.hint}</p>}
                          </div>
                        </div>
                        <IssueActions
                          issue={issue}
                          hostname={r.hostname}
                          onShowRedirectGuide={() => setRedirectGuide(r)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Always-available quick actions per row */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-[11px]"
                  onClick={() => openExternal(`https://${r.hostname}/`)}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open hostname
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-[11px]"
                  onClick={() => openExternal(`https://dnschecker.org/#A/${r.hostname}`)}
                >
                  <ExternalLink className="h-3 w-3" />
                  DNS checker
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-[11px]"
                  onClick={() => setRedirectGuide(r)}
                >
                  <RouteIcon className="h-3 w-3" />
                  Expected routes
                </Button>
              </div>

              {r.redirected && r.finalUrl && (
                <p className="text-[11px] text-muted-foreground">
                  Final URL: <code className="text-foreground">{r.finalUrl}</code>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <RedirectGuideDialog result={redirectGuide} onClose={() => setRedirectGuide(null)} />
    </div>
  );
}

function CheckPill({ label, ok, failLabel }: { label: string; ok: boolean; failLabel: string }) {
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

// Per-issue one-click actions: copy DNS values, open external diagnostics,
// or jump into the expected-redirects guide.
function IssueActions({
  issue,
  hostname,
  onShowRedirectGuide,
}: {
  issue: DomainHealthIssue;
  hostname: string;
  onShowRedirectGuide: () => void;
}) {
  const buttons: { label: string; icon: React.ReactNode; onClick: () => void }[] = [];

  // DNS / unreachable / wrong content → DNS-fix actions.
  if (issue.check === "https" || issue.check === "app_match") {
    buttons.push({
      label: "Copy A record value",
      icon: <Copy className="h-3 w-3" />,
      onClick: () => void copyToClipboard(LOVABLE_A_RECORD, "A record"),
    });
    buttons.push({
      label: "Copy hostname",
      icon: <Copy className="h-3 w-3" />,
      onClick: () => void copyToClipboard(hostname, "Hostname"),
    });
    buttons.push({
      label: "DNS checker",
      icon: <ExternalLink className="h-3 w-3" />,
      onClick: () => openExternal(`https://dnschecker.org/#A/${hostname}`),
    });
  }

  // SSL → certificate transparency log + SSL Labs report.
  if (issue.check === "ssl") {
    buttons.push({
      label: "Open cert log (crt.sh)",
      icon: <ExternalLink className="h-3 w-3" />,
      onClick: () => openExternal(`https://crt.sh/?q=${encodeURIComponent(hostname)}`),
    });
    buttons.push({
      label: "SSL Labs report",
      icon: <ExternalLink className="h-3 w-3" />,
      onClick: () =>
        openExternal(
          `https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(hostname)}&hideResults=on`,
        ),
    });
  }

  // Unexpected redirect → show the expected-routes dialog.
  if (issue.check === "redirect") {
    buttons.push({
      label: "Show expected redirects",
      icon: <RouteIcon className="h-3 w-3" />,
      onClick: onShowRedirectGuide,
    });
  }

  if (buttons.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
      {buttons.map((b, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className="h-6 gap-1 px-2 text-[10px] font-medium"
          onClick={b.onClick}
        >
          {b.icon}
          {b.label}
        </Button>
      ))}
    </div>
  );
}

// Spells out the expected DNS + redirect setup for a hostname so the user
// can copy/paste exact values into their registrar.
function RedirectGuideDialog({
  result,
  onClose,
}: {
  result: DomainHealthResult | null;
  onClose: () => void;
}) {
  if (!result) return null;
  const host = result.hostname;
  const isWww = host.toLowerCase().startsWith("www.");
  const apex = isWww ? host.slice(4) : host;
  const wwwHost = `www.${apex}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Expected DNS & redirect rules</DialogTitle>
          <DialogDescription>
            Configure these records at your DNS registrar for{" "}
            <code className="text-foreground">{host}</code>. Copy any value with one click.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <RecordRow
            label="A record (root domain)"
            type="A"
            name="@"
            value={LOVABLE_A_RECORD}
            note={`Points ${apex} at this app.`}
          />
          <RecordRow
            label="A record (www subdomain)"
            type="A"
            name="www"
            value={LOVABLE_A_RECORD}
            note={`Points ${wwwHost} at this app.`}
          />
          <RecordRow
            label="Verification TXT"
            type="TXT"
            name="_lovable"
            value="lovable_verify=…"
            note="Use the token shown when you added the hostname (not this placeholder)."
          />

          <div className="rounded-md border border-border bg-secondary/20 p-3 text-xs space-y-2">
            <p className="font-medium text-foreground">Redirect strategy</p>
            <p className="text-muted-foreground">
              Add <code className="text-foreground">{apex}</code> AND{" "}
              <code className="text-foreground">{wwwHost}</code> as separate hostnames. Mark one as{" "}
              <strong>Primary</strong> — the other will automatically redirect to it. Don't add a
              301 at your registrar; the app handles it.
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
              <li>
                Visiting <code className="text-foreground">http://{host}</code> → redirects to{" "}
                <code className="text-foreground">https://{host}</code>
              </li>
              <li>
                Visiting <code className="text-foreground">https://{isWww ? apex : wwwHost}</code> →
                redirects to <code className="text-foreground">https://{host}</code> (when {host} is
                primary)
              </li>
            </ul>
          </div>

          {result.redirected && result.finalUrl && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <p className="font-medium">Currently redirecting to</p>
              <code className="text-foreground">{result.finalUrl}</code>
              <p className="mt-1 opacity-80">
                If this isn't the URL you expect, remove any 301/302 rules at your registrar or
                upstream proxy.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecordRow({
  label,
  type,
  name,
  value,
  note,
}: {
  label: string;
  type: string;
  name: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <Badge variant="outline" className="text-[10px]">
          {type}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CopyField label="Name" value={name} />
        <CopyField label="Value" value={value} />
      </div>
      <p className="text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex gap-1">
        <input
          readOnly
          value={value}
          className="h-8 flex-1 rounded-md border border-input bg-input px-2 text-xs font-mono text-foreground outline-none"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => void copyToClipboard(value, label)}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
