import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailLogEntryRow } from "./EmailLogEntryRow";
import type { EmailLogEntry } from "@/functions/email-log.functions";

/**
 * Send-history panel for `LeadDetailDrawer`. Pure presentational — fetching
 * lives in `useLeadEmailLogs` and the parent owns the manual refresh hookup.
 */
export function LeadEmailsTab({
  email,
  emailLogs,
  loading,
  onRefresh,
}: {
  email: string;
  emailLogs: EmailLogEntry[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const hasEmail = email.length > 0;

  return (
    <div className="pt-4 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">
          Send history for {email || "this lead"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading || !hasEmail}
          className="h-7 px-2 text-xs"
          title="Refresh email send log"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>
      {!hasEmail ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Add an email address to see send history.
        </div>
      ) : loading && emailLogs.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : emailLogs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No emails sent to this lead yet.
        </div>
      ) : (
        emailLogs.map((log) => <EmailLogEntryRow key={log.id} log={log} />)
      )}
    </div>
  );
}
