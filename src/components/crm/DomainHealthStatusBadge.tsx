import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DomainHealthResult } from "@/functions/domain-health.functions";
import type { CfStatusKind } from "@/lib/domain-health.types";

export function StatusBadge({ result }: { result: DomainHealthResult }) {
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

export function CheckPill({
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

export function CfStatusBadge({ kind, label }: { kind: CfStatusKind; label: string }) {
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
