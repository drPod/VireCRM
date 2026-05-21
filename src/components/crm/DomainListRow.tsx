import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Copy, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TXT_VERIFICATION_PREFIX } from "@/lib/dns-check";
import type { AutoState, DomainRow } from "@/components/crm/custom-domains.types";

interface Props {
  row: DomainRow;
  auto: AutoState | undefined;
  isBusy: boolean;
  isOwner: boolean;
  onSetPrimary: (row: DomainRow) => void;
  onRemove: (row: DomainRow) => void;
  onVerifyNow: (row: DomainRow) => void;
}

function AutoStatusBlock({ row, auto }: { row: DomainRow; auto: AutoState | undefined }) {
  if (!auto) return null;
  if (auto.status === "checking") {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking DNS for{" "}
        <code className="text-foreground">
          {TXT_VERIFICATION_PREFIX}.{row.hostname}
        </code>
        …
      </div>
    );
  }
  if (auto.status === "waiting" && auto.nextCheckAt) {
    const remainingSec = Math.max(0, Math.ceil((auto.nextCheckAt - Date.now()) / 1000));
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Auto-checking — next attempt in {remainingSec}s
          <span className="text-muted-foreground/70">
            (attempt {Math.min(auto.attempt + 1, auto.maxAttempts)}/{auto.maxAttempts})
          </span>
        </div>
        {auto.lastError && (
          <p className="text-[11px] text-muted-foreground/80">Last check: {auto.lastError}</p>
        )}
      </div>
    );
  }
  if (auto.status === "failed") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
        <AlertCircle className="mt-0.5 h-3 w-3" />
        <div>
          Auto-verification stopped after {auto.maxAttempts} attempts.
          {auto.lastError ? ` Last error: ${auto.lastError}.` : ""} Add the TXT record at{" "}
          <code className="text-destructive">
            {TXT_VERIFICATION_PREFIX}.{row.hostname}
          </code>
          , then click <strong>Check now</strong>.
        </div>
      </div>
    );
  }
  return null;
}

export function DomainListRow({
  row,
  auto,
  isBusy,
  isOwner,
  onSetPrimary,
  onRemove,
  onVerifyNow,
}: Props) {
  const verified = !!row.verified_at;
  const isAutoChecking = !verified && (auto?.status === "checking" || auto?.status === "waiting");

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-sm font-mono text-foreground">{row.hostname}</code>
        {row.is_primary && (
          <Badge variant="secondary" className="gap-1">
            <Star className="h-3 w-3 fill-current" />
            Primary
          </Badge>
        )}
        {verified ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </Badge>
        ) : isAutoChecking ? (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Auto-verifying
          </Badge>
        ) : auto?.status === "failed" ? (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Verification failed
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Pending
          </Badge>
        )}
        {isOwner && (
          <div className="ml-auto flex gap-1.5">
            {verified && !row.is_primary && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetPrimary(row)}
                disabled={isBusy}
                className="gap-1.5"
              >
                <Star className="h-3.5 w-3.5" />
                Set primary
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(row)}
              disabled={isBusy}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        )}
      </div>

      {!verified && (
        <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
          <div>
            <p className="text-[11px] font-semibold text-foreground">Step 1 — Point DNS</p>
            <p className="text-[11px] text-muted-foreground">
              Add a CNAME or A record so <code className="text-foreground">{row.hostname}</code>{" "}
              points to this app.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-foreground">
              Step 2 — Add TXT at{" "}
              <code className="text-foreground">
                {TXT_VERIFICATION_PREFIX}.{row.hostname}
              </code>
            </p>
            <div className="mt-1 flex gap-2">
              <input
                readOnly
                value={row.verification_token}
                className="h-8 flex-1 rounded-md border border-input bg-input px-2 text-[11px] font-mono text-foreground outline-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(row.verification_token);
                  toast.success("Token copied");
                }}
                className="gap-1.5"
              >
                <Copy className="h-3 w-3" />
                Copy
              </Button>
            </div>
          </div>

          <AutoStatusBlock row={row} auto={auto} />

          <Button
            variant="command"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => onVerifyNow(row)}
            disabled={isBusy || !isOwner}
            title={!isOwner ? "Only owners can verify hostnames" : undefined}
          >
            {isBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {!isOwner
              ? "Verification requires an owner"
              : isAutoChecking
                ? "Check now"
                : auto?.status === "failed"
                  ? "Retry verification"
                  : "Check now"}
          </Button>
        </div>
      )}
    </div>
  );
}
