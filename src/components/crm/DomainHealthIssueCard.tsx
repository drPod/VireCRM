import { AlertCircle, AlertTriangle, Copy, ExternalLink, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DomainHealthIssue } from "@/functions/domain-health.functions";
import { REQUIRED_CNAME_TARGET } from "@/lib/dns-check";
import { copyValueToClipboard, openExternal } from "@/lib/domain-health-utils";

interface IssueCardProps {
  issue: DomainHealthIssue;
  hostname: string;
  onShowRedirectGuide: () => void;
}

/**
 * One issue row from a domain-health probe, with severity styling + a
 * one-click action strip tailored to the failure mode.
 */
export function DomainHealthIssueCard({ issue, hostname, onShowRedirectGuide }: IssueCardProps) {
  const isError = issue.severity === "error";
  return (
    <div
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
        hostname={hostname}
        onShowRedirectGuide={onShowRedirectGuide}
      />
    </div>
  );
}

interface ActionButton {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

// Per-issue one-click actions: copy DNS values, open external diagnostics,
// or jump into the expected-redirects guide.
function IssueActions({ issue, hostname, onShowRedirectGuide }: IssueCardProps) {
  const buttons: ActionButton[] = [];

  // DNS / unreachable / wrong content → DNS-fix actions.
  if (issue.check === "https" || issue.check === "app_match") {
    buttons.push({
      label: "Copy CNAME target",
      icon: <Copy className="h-3 w-3" />,
      onClick: () => void copyValueToClipboard(REQUIRED_CNAME_TARGET, "CNAME target"),
    });
    buttons.push({
      label: "Copy hostname",
      icon: <Copy className="h-3 w-3" />,
      onClick: () => void copyValueToClipboard(hostname, "Hostname"),
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
