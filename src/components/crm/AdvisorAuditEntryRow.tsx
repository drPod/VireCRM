import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Loader2,
  Play,
  Repeat2,
  Workflow,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/advisor-audit-utils";
import type { AdvisorAuditEntry } from "@/functions/advisor-audit.functions";

interface AdvisorAuditEntryRowProps {
  entry: AdvisorAuditEntry;
  isOpen: boolean;
  onToggle: () => void;
  userLabel: string | null;
  isReplaying: boolean;
  anyReplaying: boolean;
  onReplay: () => void;
}

export function AdvisorAuditEntryRow({
  entry,
  isOpen,
  onToggle,
  userLabel,
  isReplaying,
  anyReplaying,
  onReplay,
}: AdvisorAuditEntryRowProps) {
  const PhaseIcon = entry.phase === "plan" ? Brain : Play;
  const handlers = (entry.handlers ?? null) as Record<string, number> | null;
  const n8nCount = handlers?.n8n ?? 0;
  const planObj = entry.plan as { actions?: unknown[] } | null;
  const actionCount = Array.isArray(planObj?.actions) ? planObj.actions.length : 0;

  return (
    <li className="px-5 py-3">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 text-left"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
        )}
        <PhaseIcon
          className={`h-4 w-4 mt-1 shrink-0 ${
            entry.phase === "plan" ? "text-primary" : "text-success"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {entry.command}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase">
              {entry.phase}
            </Badge>
            {entry.phase === "execute" && (
              <>
                {entry.ok_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    {entry.ok_count}
                  </span>
                )}
                {entry.error_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                    <XCircle className="h-3 w-3" />
                    {entry.error_count}
                  </span>
                )}
                {entry.skipped_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CircleDashed className="h-3 w-3" />
                    {entry.skipped_count}
                  </span>
                )}
                {n8nCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                    <Workflow className="h-3 w-3" />
                    {n8nCount} n8n
                  </span>
                )}
              </>
            )}
          </div>
          {entry.summary && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.summary}</p>
          )}
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {timeAgo(entry.created_at)} · {entry.duration_ms}ms
            {userLabel ? ` · ${userLabel}` : ""}
            {entry.error_message ? ` · ${entry.error_message}` : ""}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="mt-3 ml-7 space-y-3">
          {entry.phase === "execute" && Array.isArray(entry.results) && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                CRM updates
              </div>
              <ul className="space-y-1">
                {(entry.results as Array<Record<string, unknown>>).map((r, i) => (
                  <li
                    key={`${entry.id}-${i}`}
                    className="text-xs text-foreground bg-background/40 border border-border rounded-md px-2.5 py-1.5"
                  >
                    <span className="text-muted-foreground mr-2">
                      {String(r.type ?? "?")} · {String(r.status ?? "?")}
                      {r.handler === "n8n" ? " · n8n" : ""}
                    </span>
                    {String(r.message ?? "")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entry.plan != null && (
            <>
              {actionCount > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onReplay}
                    disabled={isReplaying || anyReplaying}
                    className="h-7 text-xs"
                  >
                    {isReplaying ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Repeat2 className="h-3 w-3" />
                    )}
                    <span className="ml-1.5">
                      {isReplaying ? "Replaying…" : "Replay this command"}
                    </span>
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Re-runs {actionCount} action
                    {actionCount === 1 ? "" : "s"} with the same guardrails
                  </span>
                </div>
              )}
              <details className="group">
                <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  JSON plan
                </summary>
                <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-background/60 p-2 text-[11px] text-foreground">
                  {JSON.stringify(entry.plan, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      )}
    </li>
  );
}
