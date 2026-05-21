import { ExternalLink, Globe, Route as RouteIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DomainHealthResult } from "@/functions/domain-health.functions";
import { openExternal } from "@/lib/domain-health-utils";
import type { CfHostnamePollFn } from "@/hooks/useCfHostnameStatus";
import { CfHostnameStatus } from "./CfHostnameStatus";
import { DomainHealthIssueCard } from "./DomainHealthIssueCard";
import { CheckPill, StatusBadge } from "./DomainHealthStatusBadge";

interface DomainHealthRowProps {
  result: DomainHealthResult;
  organizationId: string | undefined;
  pollCf: CfHostnamePollFn;
  onShowRedirectGuide: (result: DomainHealthResult) => void;
}

/**
 * A single hostname's health-check card: status header, the 4-check matrix,
 * CF for SaaS state, issues with remediation actions, and quick-action links.
 */
export function DomainHealthRow({
  result,
  organizationId,
  pollCf,
  onShowRedirectGuide,
}: DomainHealthRowProps) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <code className="text-sm font-mono text-foreground">{result.hostname}</code>
        <StatusBadge result={result} />
        {result.httpStatus !== null && (
          <Badge variant="outline" className="text-[10px]">
            HTTP {result.httpStatus}
          </Badge>
        )}
        {result.responseMs !== null && (
          <span className="text-[11px] text-muted-foreground">{result.responseMs}ms</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CheckPill label="HTTPS" ok={result.httpsReachable} failLabel="Unreachable" />
        <CheckPill label="SSL" ok={result.sslValid} failLabel="Invalid cert" />
        <CheckPill
          label="Status"
          ok={result.httpStatus !== null && result.httpStatus < 400}
          failLabel={result.httpStatus ? `HTTP ${result.httpStatus}` : "No response"}
        />
        <CheckPill
          label="Serves this app"
          ok={result.servesThisApp}
          failLabel="Wrong content"
        />
      </div>

      {organizationId && (
        <CfHostnameStatus
          organizationId={organizationId}
          hostname={result.hostname}
          poll={pollCf}
        />
      )}

      {result.issues.length > 0 && (
        <div className="space-y-1.5">
          {result.issues.map((issue, idx) => (
            <DomainHealthIssueCard
              key={idx}
              issue={issue}
              hostname={result.hostname}
              onShowRedirectGuide={() => onShowRedirectGuide(result)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          onClick={() => openExternal(`https://${result.hostname}/`)}
        >
          <ExternalLink className="h-3 w-3" />
          Open hostname
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          onClick={() => openExternal(`https://dnschecker.org/#A/${result.hostname}`)}
        >
          <ExternalLink className="h-3 w-3" />
          DNS checker
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          onClick={() => onShowRedirectGuide(result)}
        >
          <RouteIcon className="h-3 w-3" />
          Expected routes
        </Button>
      </div>

      {result.redirected && result.finalUrl && (
        <p className="text-[11px] text-muted-foreground">
          Final URL: <code className="text-foreground">{result.finalUrl}</code>
        </p>
      )}
    </div>
  );
}
