import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Mail, MessageSquare, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/date-utils";
import { htmlToPlainText } from "@/lib/text-utils";

export interface ActivityItem {
  id: string;
  type: "email" | "reply" | "task" | "won";
  title: string;
  content: string;
  date: string;
  status?: string;
  sentiment?: string | null;
}

export function ActivityEntry({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false);

  const iconMap = {
    email: <Mail className="h-3.5 w-3.5" />,
    reply: <MessageSquare className="h-3.5 w-3.5" />,
    task: <Clock className="h-3.5 w-3.5" />,
    won: <Trophy className="h-3.5 w-3.5" />,
  };

  const colorMap = {
    email: "bg-primary/15 text-primary border-primary/20",
    reply: "bg-accent text-accent-foreground border-accent",
    task: "bg-secondary text-secondary-foreground border-secondary",
    won: "bg-success/15 text-success border-success/30",
  };

  const sentimentBadge = item.sentiment ? (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 h-4 ${
        item.sentiment === "positive"
          ? "border-green-500/30 text-green-400"
          : item.sentiment === "negative"
            ? "border-red-500/30 text-red-400"
            : "border-muted text-muted-foreground"
      }`}
    >
      {item.sentiment}
    </Badge>
  ) : null;

  const timeAgo = formatRelativeTime(item.date);
  const plainContent = useMemo(() => htmlToPlainText(item.content || ""), [item.content]);
  const isLong = plainContent.length > 180 || plainContent.includes("\n");
  const canExpand = isLong && item.type === "email";

  return (
    <div className="relative pl-9 pb-4 group">
      {/* Icon dot */}
      <div
        className={`absolute left-1.5 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border ${colorMap[item.type]}`}
      >
        {iconMap[item.type]}
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground truncate">{item.title}</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo}</span>
        </div>

        {plainContent && !expanded && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">
            {plainContent}
          </p>
        )}
        {plainContent && expanded && (
          <pre className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans bg-muted/40 rounded-md p-2 max-h-72 overflow-y-auto">
            {plainContent}
          </pre>
        )}

        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            {expanded ? (
              <>
                <ChevronDown className="h-3 w-3" /> Hide full message
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3" /> View full message
              </>
            )}
          </button>
        )}

        <div className="flex items-center gap-1.5">
          {item.status && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
              {item.status}
            </Badge>
          )}
          {sentimentBadge}
        </div>
      </div>
    </div>
  );
}
