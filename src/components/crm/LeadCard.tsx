import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Phone, Calendar, Zap, Building2, CalendarClock, User, Users, Share2, Send } from "lucide-react";
import { AssigneeAvatars, type AssigneeLite } from "./AssigneeAvatars";

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status: "new" | "contacted" | "qualified" | "negotiation" | "won" | "lost";
  score: number;
  lastContact?: string;
  nextAction?: string;
  /** Yearly electricity usage in kilowatt-hours. Energy-broker workflow. */
  annualKwh?: number | null;
  /** When the lead's current energy contract ends (ISO date, YYYY-MM-DD). */
  contractEndDate?: string | null;
  /** Lead's current energy supplier (e.g. "British Gas"). */
  currentSupplier?: string | null;
  /** UUID of the org member this lead is primarily assigned to (legacy). */
  assignedTo?: string | null;
  /** UUID of the employee who created the lead (lead "owner" for sharing). */
  createdBy?: string | null;
  /** Display name of the primary assignee (resolved from profiles). */
  assigneeName?: string | null;
  /** All assignees (multi-assign join table). Includes the primary one. */
  assignees?: AssigneeLite[];
  /** Number of teammates this lead is currently shared with. */
  shareCount?: number;
}

const statusConfig: Record<Lead["status"], { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" | "destructive" }> = {
  new: { label: "New", variant: "info" },
  contacted: { label: "Contacted", variant: "secondary" },
  qualified: { label: "Qualified", variant: "warning" },
  negotiation: { label: "Negotiation", variant: "default" },
  won: { label: "Won", variant: "success" },
  lost: { label: "Lost", variant: "destructive" },
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{score}</span>
    </div>
  );
}

export function LeadCard({
  lead,
  onClick,
  selectable = false,
  selected = false,
  onSelectedChange,
  onSendEmail,
}: {
  lead: Lead;
  onClick?: () => void;
  /** Show a selection checkbox in the corner. */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (next: boolean) => void;
  /** When provided, renders a quick "Send email" action on the card. */
  onSendEmail?: (lead: Lead) => void;
}) {
  const status = statusConfig[lead.status];
  const canSendEmail = Boolean(onSendEmail && lead.email);

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-lg border p-4 transition-colors hover:border-primary/30 hover:bg-accent/30 cursor-pointer ${
        selected ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {selectable && (
          <div
            className="pt-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onSelectedChange?.(!selected);
            }}
          >
            <Checkbox
              checked={selected}
              aria-label={`Select ${lead.name}`}
              onCheckedChange={(v) => onSelectedChange?.(v === true)}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="truncate text-sm font-semibold text-foreground">{lead.name}</h4>
          {lead.company && (
            <p className="text-xs text-muted-foreground">{lead.company}</p>
          )}
        </div>
        <Badge variant={status.variant} className="ml-2 shrink-0">
          {status.label}
        </Badge>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          <span className="truncate">{lead.email}</span>
        </div>
        {lead.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{lead.phone}</span>
          </div>
        )}
        {lead.currentSupplier && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{lead.currentSupplier}</span>
          </div>
        )}
        {typeof lead.annualKwh === "number" && lead.annualKwh > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span>{lead.annualKwh.toLocaleString()} kWh / yr</span>
          </div>
        )}
        {lead.contractEndDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            <span>Contract ends {formatContractDate(lead.contractEndDate)}</span>
          </div>
        )}
        {lead.nextAction && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{lead.nextAction}</span>
          </div>
        )}
        {(() => {
          const list = lead.assignees ?? [];
          if (list.length > 1) {
            return (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <AssigneeAvatars assignees={list} size="sm" max={4} />
                <span className="truncate">
                  {list.length} assignees
                </span>
              </div>
            );
          }
          if (list.length === 1 || lead.assigneeName) {
            const name = list[0]?.full_name ?? lead.assigneeName ?? "";
            return (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">Assigned to {name}</span>
              </div>
            );
          }
          return null;
        })()}
        {typeof lead.shareCount === "number" && lead.shareCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-primary/80">
            <Share2 className="h-3 w-3" />
            <span>
              Shared with {lead.shareCount} teammate{lead.shareCount === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Lead Score</span>
        <ScoreBar score={lead.score} />
      </div>
    </div>
  );
}

/**
 * Format an ISO date (YYYY-MM-DD) as a short, locale-friendly contract end
 * label. Falls back to the raw string if parsing fails so we never show
 * "Invalid Date" on the card.
 */
function formatContractDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
