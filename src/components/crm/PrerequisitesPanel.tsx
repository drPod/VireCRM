/**
 * Inline panel that surfaces missing prerequisites for an integration card,
 * each with a clear "next step" the user can act on.
 *
 * Renders nothing when everything is in order — so cards stay quiet once
 * they're fully wired up. The component is purely presentational; the
 * caller decides which prerequisites to feed in based on the integration's
 * current status, and which action handler to wire to the "Run next step"
 * button via the optional `onAction` prop.
 */
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type PrerequisiteSeverity = "blocking" | "recommended";

/**
 * Machine-readable hint for what the "Run next step" button should do.
 * The card owner interprets these — we don't hard-code behaviour here.
 */
export type PrerequisiteActionId =
  | "connect" // Start the OAuth/Enable flow.
  | "reconnect" // Disconnect + reconnect (or rerun OAuth).
  | "test" // Re-run the verify/test call.
  | "edit-config" // Open the inline config editor.
  | "edit-key" // Open the BYO API key editor.
  | "focus-key-input" // Focus the empty API key field on a fresh card.
  | "open-docs"; // Fallback — open the provider's docs.

export interface Prerequisite {
  /** Stable id for React keys + analytics. */
  id: string;
  /** Short title — what's missing. */
  title: string;
  /** One-line plain-English explanation of what to do. */
  nextStep: string;
  /** "blocking" = integration won't work; "recommended" = works but degraded. */
  severity: PrerequisiteSeverity;
  /** Optional deep link (provider docs, internal route) the user can open. */
  link?: { label: string; href: string; external?: boolean };
  /**
   * Optional action hint. When the parent provides an `onAction` handler that
   * recognises this id, the panel renders a "Run next step" button.
   */
  actionId?: PrerequisiteActionId;
  /** Optional override for the action button label (default: "Run next step"). */
  actionLabel?: string;
}

interface Props {
  prerequisites: Prerequisite[];
  /** Provider name, used in the "all set" empty-state copy when forceShow is on. */
  providerLabel?: string;
  /**
   * When true, render an "All prerequisites met" success row even with an
   * empty list. Default false (we hide the panel entirely when nothing's
   * missing to keep the card compact).
   */
  forceShow?: boolean;
  /**
   * Handler invoked when the user clicks "Run next step" on a row. May be
   * async — the panel will show a spinner on the clicked row until it
   * resolves. If omitted, no action button is rendered.
   */
  onAction?: (prereq: Prerequisite) => void | Promise<void>;
  /**
   * Optional verification context. When at least one blocking prereq is
   * present and we know when the integration was last verified (or have a
   * provider-side error from the last run), the panel renders a small
   * footer with that timestamp + cause so the user doesn't have to dig
   * through a separate Test panel to find it.
   */
  verification?: {
    /** ISO timestamp of the most recent verification attempt, success or fail. */
    lastVerifiedAt?: string | null;
    /** "ok" / "failed" / "unknown" — drives the verification footer wording. */
    outcome: "ok" | "failed" | "unknown";
    /** Provider error returned on the last failed run, when known. */
    failureReason?: string | null;
  };
}

/** Compact relative-time formatter for the verification footer. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function PrerequisitesPanel({
  prerequisites,
  providerLabel,
  forceShow,
  onAction,
  verification,
}: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (prerequisites.length === 0) {
    if (!forceShow) return null;
    return (
      <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2 flex items-start gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
        <p className="text-[11px] text-foreground">
          {providerLabel ? `${providerLabel} is fully configured.` : "All prerequisites met."}
        </p>
      </div>
    );
  }

  const hasBlocking = prerequisites.some((p) => p.severity === "blocking");
  const tone = hasBlocking ? "border-warning/40 bg-warning/5" : "border-border bg-secondary/30";
  const iconTone = hasBlocking ? "text-warning" : "text-muted-foreground";

  const handleRun = async (p: Prerequisite) => {
    if (!onAction || !p.actionId) return;
    setPendingId(p.id);
    try {
      await onAction(p);
    } finally {
      setPendingId((cur) => (cur === p.id ? null : cur));
    }
  };

  return (
    <div className={`rounded-md border ${tone} p-3 space-y-2`}>
      <div className="flex items-center gap-1.5">
        <AlertTriangle className={`h-3.5 w-3.5 ${iconTone}`} />
        <p className="text-[11px] font-semibold text-foreground">
          {hasBlocking
            ? `${prerequisites.length} thing${prerequisites.length === 1 ? "" : "s"} to finish before this works`
            : `${prerequisites.length} optional setup step${prerequisites.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <ul className="space-y-1.5">
        {prerequisites.map((p) => {
          const actionable = !!onAction && !!p.actionId;
          const isPending = pendingId === p.id;
          return (
            <li key={p.id} className="text-[11px] text-foreground">
              <div className="flex items-start gap-1.5">
                <span
                  aria-hidden="true"
                  className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    p.severity === "blocking" ? "bg-warning" : "bg-muted-foreground"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-muted-foreground">
                    {p.nextStep}
                    {p.link && (
                      <>
                        {" "}
                        <a
                          href={p.link.href}
                          target={p.link.external ? "_blank" : undefined}
                          rel={p.link.external ? "noreferrer" : undefined}
                          className="text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          {p.link.label}
                          {p.link.external && <ExternalLink className="h-2.5 w-2.5" />}
                        </a>
                      </>
                    )}
                  </p>
                  {actionable && (
                    <div className="mt-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] gap-1"
                        disabled={isPending || pendingId !== null}
                        onClick={() => void handleRun(p)}
                      >
                        {isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3 w-3" />
                        )}
                        {p.actionLabel ?? "Run next step"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {hasBlocking &&
        verification &&
        (verification.lastVerifiedAt || verification.failureReason) && (
          <div className="mt-1 pt-2 border-t border-warning/20 text-[10.5px] text-muted-foreground space-y-0.5">
            {verification.lastVerifiedAt && (
              <div
                className="flex items-center gap-1"
                title={new Date(verification.lastVerifiedAt).toLocaleString()}
              >
                <Clock className="h-3 w-3 shrink-0" />
                <span>
                  Last checked {formatRelative(verification.lastVerifiedAt)}
                  {verification.outcome === "ok"
                    ? " — succeeded"
                    : verification.outcome === "failed"
                      ? " — failed"
                      : ""}
                </span>
              </div>
            )}
            {verification.outcome === "failed" && verification.failureReason && (
              <div className="text-foreground/80 break-words leading-snug">
                <span className="font-medium">Cause:</span> {verification.failureReason}
              </div>
            )}
          </div>
        )}
    </div>
  );
}
