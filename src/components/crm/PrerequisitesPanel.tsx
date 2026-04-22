/**
 * Inline panel that surfaces missing prerequisites for an integration card,
 * each with a clear "next step" the user can act on.
 *
 * Renders nothing when everything is in order — so cards stay quiet once
 * they're fully wired up. The component is purely presentational; the
 * caller decides which prerequisites to feed in based on the integration's
 * current status.
 */
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";

export type PrerequisiteSeverity = "blocking" | "recommended";

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
}

export function PrerequisitesPanel({ prerequisites, providerLabel, forceShow }: Props) {
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
  const tone = hasBlocking
    ? "border-warning/40 bg-warning/5"
    : "border-border bg-secondary/30";
  const iconTone = hasBlocking ? "text-warning" : "text-muted-foreground";

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
        {prerequisites.map((p) => (
          <li key={p.id} className="text-[11px] text-foreground">
            <div className="flex items-start gap-1.5">
              <span
                aria-hidden="true"
                className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  p.severity === "blocking" ? "bg-warning" : "bg-muted-foreground"
                }`}
              />
              <div className="min-w-0">
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
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
