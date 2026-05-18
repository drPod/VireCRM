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
import {
  pollCustomHostnameStatusFn,
  type CustomHostnameSnapshot,
} from "@/functions/custom-hostnames.functions";
import { isNotConfigured, describeError } from "@/lib/cf-saas-errors";

import { REQUIRED_CNAME_TARGET } from "@/lib/dns-check";

const CRM_CNAME_TARGET = REQUIRED_CNAME_TARGET;

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
  const pollCf = useAuthedServerFn(pollCustomHostnameStatusFn);
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

              {/* Cloudflare for SaaS status (per-hostname poll). Surfaces the
                  CF custom-hostname + SSL cert state separately from the live
                  HTTPS probe above so operators can see when a hostname is
                  still being provisioned vs. fully active. */}
              {organizationId && (
                <CfHostnameStatus
                  organizationId={organizationId}
                  hostname={r.hostname}
                  poll={pollCf}
                />
              )}

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
      label: "Copy CNAME target",
      icon: <Copy className="h-3 w-3" />,
      onClick: () => void copyToClipboard(CRM_CNAME_TARGET, "CNAME target"),
    });
    buttons.push({
      label: "Copy hostname",
      icon: <Copy className="h-3 w-3" />,
      onClick: () => void copyToClipboard(hostname, "Hostname"),
    });
    buttons.push({
      label: "DNS checker",
      icon: <ExternalLink className="h-3 w-3" />,
      onClick: () => openExternal(`https://dnschecker.org/#CNAME/${hostname}`),
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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Expected DNS records</DialogTitle>
          <DialogDescription>
            Configure these records at your DNS registrar for{" "}
            <code className="text-foreground">{host}</code>. Copy any value with one click.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <RecordRow
            label="CNAME (hostname → SaaS)"
            type="CNAME"
            name={host}
            value={CRM_CNAME_TARGET}
            note={`Points ${host} at our Cloudflare for SaaS fallback. SSL is issued automatically.`}
          />
          <RecordRow
            label="Verification TXT"
            type="TXT"
            name={`_majix.${host}`}
            value="majix-verify-…"
            note="Use the token shown when you added the hostname (not this placeholder)."
          />

          <div className="rounded-md border border-border bg-secondary/20 p-3 text-xs space-y-2">
            <p className="font-medium text-foreground">Setup notes</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
              <li>
                Use a subdomain (e.g. <code className="text-foreground">crm.yourcompany.com</code>)
                — apex domains can't legally hold a CNAME at most registrars.
              </li>
              <li>
                Both HTTP and HTTPS on <code className="text-foreground">{host}</code> are served —
                Cloudflare upgrades to HTTPS automatically.
              </li>
              <li>
                Don't add a 301 at your registrar; the app handles redirects between configured
                hostnames.
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

type CfStatusKind =
  | "loading"
  | "active"
  | "ssl"
  | "verifying"
  | "failed"
  | "unprovisioned"
  | "unconfigured"
  | "error";

function classifyCfStatus(snap: CustomHostnameSnapshot | null): {
  kind: CfStatusKind;
  label: string;
} {
  if (!snap) return { kind: "unprovisioned", label: "Not provisioned" };
  const status = snap.status;
  const ssl = snap.sslStatus;
  const failed = new Set(["blocked", "deleted", "deactivated", "test_blocked", "test_failed"]);
  if (failed.has(status)) return { kind: "failed", label: "Failed" };
  if (status === "active" || status === "active_redeploying") {
    if (ssl === "active") return { kind: "active", label: "Active" };
    return { kind: "ssl", label: "Setting up SSL" };
  }
  // pending, pending_blocked, pending_migration, pending_deletion, test_pending,
  // test_active, test_active_apex, moved → all map to "Verifying" while the
  // hostname clears CF's ownership/DCV gauntlet.
  return { kind: "verifying", label: "Verifying" };
}

function CfStatusBadge({ kind, label }: { kind: CfStatusKind; label: string }) {
  if (kind === "loading") {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking Cloudflare…
      </Badge>
    );
  }
  if (kind === "active") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {label}
      </Badge>
    );
  }
  if (kind === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        {label}
      </Badge>
    );
  }
  if (kind === "unconfigured" || kind === "unprovisioned" || kind === "error") {
    return (
      <Badge variant="outline" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {label}
      </Badge>
    );
  }
  // verifying / ssl
  return (
    <Badge variant="warning" className="gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      {label}
    </Badge>
  );
}

// One-shot CF status poll per row. Brief is "keep it simple, per-hostname,
// not bulk" — so this just fetches once on mount + offers a manual refresh.
// No polling loop; a periodic sweeper that writes back cf_status into the
// DB is tracked separately (next pickup item).
function CfHostnameStatus({
  organizationId,
  hostname,
  poll,
}: {
  organizationId: string;
  hostname: string;
  poll: (opts: {
    data: { organizationId: string; hostname: string };
  }) => Promise<CustomHostnameSnapshot | null>;
}) {
  const [snapshot, setSnapshot] = useState<CustomHostnameSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  // unconfigured = 503 from server fn (CLOUDFLARE_API_TOKEN / _ZONE_ID missing).
  // error = other failure; we show the message inline rather than toasting
  // since this panel may render many rows and a toast storm would be noisy.
  const [state, setState] = useState<CfStatusKind>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await poll({ data: { organizationId, hostname } });
      setSnapshot(result);
      if (!result) {
        setState("unprovisioned");
      } else {
        setState(classifyCfStatus(result).kind);
      }
    } catch (err) {
      if (isNotConfigured(err)) {
        setState("unconfigured");
        setErrorMsg("Cloudflare for SaaS not configured on this worker.");
      } else {
        setState("error");
        setErrorMsg(describeError(err) || "Cloudflare poll failed");
      }
    } finally {
      setLoading(false);
    }
  }, [poll, organizationId, hostname]);

  useEffect(() => {
    void run();
  }, [run]);

  const classification = snapshot
    ? classifyCfStatus(snapshot)
    : {
        kind: state,
        label:
          state === "unprovisioned"
            ? "Not provisioned"
            : state === "unconfigured"
              ? "CF not configured"
              : state === "error"
                ? "Cloudflare poll failed"
                : "",
      };
  const kind: CfStatusKind = loading ? "loading" : state;
  const label = kind === "loading" ? "Checking…" : classification.label;

  return (
    <div className="rounded-md border border-border bg-background/60 px-3 py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-foreground">Cloudflare for SaaS</span>
        <CfStatusBadge kind={kind} label={label} />
        {snapshot?.sslStatus && (
          <Badge variant="outline" className="text-[10px]">
            SSL: {snapshot.sslStatus}
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-6 gap-1 px-2 text-[10px]"
          onClick={() => void run()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Refresh
        </Button>
      </div>
      {errorMsg && <p className="text-[11px] text-muted-foreground">{errorMsg}</p>}
      {snapshot?.ownershipVerification && (
        <p className="text-[11px] text-muted-foreground">
          Ownership TXT pending:{" "}
          <code className="text-foreground">{snapshot.ownershipVerification.name}</code>
        </p>
      )}
      {(snapshot?.sslValidationRecords?.length ?? 0) > 0 && (
        <p className="text-[11px] text-muted-foreground">
          SSL DCV TXT pending ({snapshot!.sslValidationRecords.length} record
          {snapshot!.sslValidationRecords.length === 1 ? "" : "s"}) at customer DNS.
        </p>
      )}
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
