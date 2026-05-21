import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/date-utils";
import { htmlToPlainText } from "@/lib/text-utils";
import type { EmailLogEntry } from "@/functions/email-log.functions";

export function EmailLogEntryRow({ log }: { log: EmailLogEntry }) {
  const status = (log.status || "unknown").toLowerCase();
  const colorClass =
    status === "sent" || status === "delivered"
      ? "border-green-500/30 text-green-400 bg-green-500/10"
      : status === "pending" || status === "queued"
        ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
        : status === "suppressed"
          ? "border-orange-500/30 text-orange-400 bg-orange-500/10"
          : status === "failed" || status === "error" || status === "bounced"
            ? "border-red-500/30 text-red-400 bg-red-500/10"
            : "border-muted text-muted-foreground bg-muted/30";

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Inbox className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground truncate">{log.template_name}</span>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {formatRelativeTime(log.created_at)}
        </span>
      </div>
      {log.subject && (
        <p className="text-xs text-foreground/90 font-medium leading-snug line-clamp-1">
          {log.subject}
        </p>
      )}
      {log.body_preview &&
        (() => {
          const cleaned = htmlToPlainText(log.body_preview);
          return cleaned ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 whitespace-pre-wrap">
              {cleaned}
            </p>
          ) : null;
        })()}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 capitalize ${colorClass}`}>
          {status}
        </Badge>
        <span className="text-[10px] text-muted-foreground truncate">{log.recipient_email}</span>
      </div>
      {log.error_message && (
        <p className="text-[11px] text-red-400 leading-relaxed line-clamp-2">{log.error_message}</p>
      )}
    </div>
  );
}
