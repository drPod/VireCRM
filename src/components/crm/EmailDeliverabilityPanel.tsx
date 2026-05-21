/**
 * Email Deliverability panel — runs SPF/DKIM/DMARC checks against the org's
 * sending domain and surfaces actionable fixes.
 *
 * Sits inside Settings → Integrations next to the Business Email card, so
 * the loop is tight: set your business email → check the records that
 * govern its deliverability → fix anything red.
 *
 * Auto-runs on mount and re-runs on demand. We toast a destructive alert
 * if any check fails, so the user notices even if they don't expand the
 * panel.
 */
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Loader2,
  RefreshCw,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  checkEmailDeliverability,
  type DeliverabilityRecord,
  type DeliverabilityStatus,
  type CheckEmailDeliverabilityResponse,
} from "@/functions/email-deliverability.functions";

interface Props {
  organizationId: string | null | undefined;
}

const CHECK_LABELS: Record<DeliverabilityRecord["check"], string> = {
  spf: "SPF",
  dkim: "DKIM",
  dmarc: "DMARC",
};

const CHECK_DESCRIPTIONS: Record<DeliverabilityRecord["check"], string> = {
  spf: "Authorises which servers can send mail as your domain.",
  dkim: "Cryptographically signs outbound mail so receivers can verify it.",
  dmarc: "Tells mailbox providers what to do when SPF or DKIM fails.",
};

function StatusBadge({ status }: { status: DeliverabilityStatus }) {
  if (status === "pass") {
    return (
      <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/15">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Pass
      </Badge>
    );
  }
  if (status === "warn") {
    return (
      <Badge className="bg-warning/15 text-warning border border-warning/30 hover:bg-warning/15">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Warning
      </Badge>
    );
  }
  if (status === "fail") {
    return (
      <Badge className="bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/15">
        <ShieldAlert className="h-3 w-3 mr-1" />
        Fail
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <ShieldQuestion className="h-3 w-3 mr-1" />
      Unknown
    </Badge>
  );
}

export function EmailDeliverabilityPanel({ organizationId }: Props) {
  const run = useServerFn(checkEmailDeliverability);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckEmailDeliverabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Avoid re-toasting the same critical state on every refetch.
  const lastAlertedAt = useRef<string | null>(null);

  const refresh = async (silent = false) => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await run({ data: { organizationId } });
      setResult(res);
      if (!silent && res.hasCriticalIssue && lastAlertedAt.current !== res.checkedAt) {
        lastAlertedAt.current = res.checkedAt;
        const failing = res.records
          .filter((r) => r.status === "fail")
          .map((r) => CHECK_LABELS[r.check])
          .join(", ");
        toast.error(`Email deliverability misconfigured: ${failing}`, {
          description: "Recipients may flag your outreach as spam. Fix the failing records below.",
          duration: 8000,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to run checks";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run on mount / org change. Silent because we don't want a toast on
  // first paint — the panel itself shows the state.
  useEffect(() => {
    if (organizationId) {
      void refresh(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const copyRecord = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed — select the text manually.");
    }
  };

  const overallIcon = (() => {
    if (!result || result.records.length === 0) return ShieldQuestion;
    if (result.records.some((r) => r.status === "fail")) return ShieldAlert;
    if (result.records.some((r) => r.status === "warn")) return AlertTriangle;
    return ShieldCheck;
  })();

  const OverallIcon = overallIcon;
  const overallTone = result?.records.some((r) => r.status === "fail")
    ? "text-destructive"
    : result?.records.some((r) => r.status === "warn")
      ? "text-warning"
      : result && result.records.length > 0
        ? "text-success"
        : "text-muted-foreground";

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <OverallIcon className={`h-5 w-5 mt-0.5 ${overallTone}`} />
          <div>
            <h3 className="font-semibold text-foreground">Email Deliverability</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Automatic SPF, DKIM, and DMARC verification for the domain your outreach sends from.
            </p>
            {result?.domain && (
              <p className="text-xs text-muted-foreground mt-2">
                Checking <span className="font-mono text-foreground">{result.domain}</span>
                {result.source === "support_email" ? (
                  <> — derived from your business email.</>
                ) : result.source === "custom_domain" ? (
                  <> — your verified custom domain.</>
                ) : null}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh(false)}
          disabled={loading || !organizationId}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Re-check</span>
        </Button>
      </div>

      {!organizationId && (
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Sign in with an organisation to run deliverability checks.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && !result.domain && (
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            No business email or verified custom domain is set yet. Add a business email above and
            we'll inspect its DNS automatically.
          </span>
        </div>
      )}

      {result && result.records.length > 0 && (
        <div className="space-y-3">
          {result.records.map((record) => (
            <div
              key={record.check}
              className="rounded-lg border border-border bg-background/40 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {CHECK_LABELS[record.check]}
                    </span>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {CHECK_DESCRIPTIONS[record.check]}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground">{record.summary}</p>
                <p className="text-sm text-muted-foreground mt-1">{record.detail}</p>
              </div>

              {record.rawRecords.length > 0 && (
                <div className="rounded-md bg-muted/40 border border-border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                    Found at <span className="font-mono">{record.queried}</span>
                  </p>
                  {record.rawRecords.map((raw, idx) => (
                    <code
                      key={idx}
                      className="block text-xs text-foreground font-mono break-all py-0.5"
                    >
                      {raw}
                    </code>
                  ))}
                </div>
              )}

              {record.suggestedRecord && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-primary">
                        Suggested DNS record
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Type:{" "}
                        <span className="font-mono text-foreground">
                          {record.suggestedRecord.type}
                        </span>
                        {"  "}·{"  "}Host:{" "}
                        <span className="font-mono text-foreground">
                          {record.suggestedRecord.host}
                        </span>
                      </p>
                      <code className="block text-xs text-foreground font-mono break-all bg-background/60 rounded px-2 py-1">
                        {record.suggestedRecord.value}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyRecord(record.suggestedRecord!.value)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {record.selectorsTried && record.selectorsTried.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Selectors checked: {record.selectorsTried.join(", ")}
                </p>
              )}
            </div>
          ))}

          <p className="text-[11px] text-muted-foreground">
            Last checked {new Date(result.checkedAt).toLocaleString()} · DNS lookups via Cloudflare
            1.1.1.1
          </p>
        </div>
      )}

      {!result && loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running deliverability checks…
        </div>
      )}
    </Card>
  );
}
