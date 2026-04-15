import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Calendar } from "lucide-react";

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

export function LeadCard({ lead }: { lead: Lead }) {
  const status = statusConfig[lead.status];

  return (
    <div className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/30">
      <div className="flex items-start justify-between">
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
        {lead.nextAction && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{lead.nextAction}</span>
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
