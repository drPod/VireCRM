import { Clock, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatRelativeTime } from "@/lib/date-utils";
import { AssigneeAvatars } from "./AssigneeAvatars";
import { LeadConnectorActions } from "./LeadConnectorActions";
import { LeadFollowupButton } from "./LeadFollowupButton";
import { LeadScoreButton } from "./LeadScoreButton";
import type { ActivityItem } from "./ActivityEntry";
import type { EmailLogEntry } from "@/functions/email-log.functions";
import type { Lead } from "./LeadCard";
import type { LeadBillingSummary, LeadDrawerTab, OrgMember } from "./LeadDetailDrawer.types";

interface LeadDetailDrawerHeaderProps {
  lead: Lead;
  formName: string;
  formEmail: string;
  formPhone: string;
  effectiveEmail: string;
  assigneeIds: string[];
  members: OrgMember[];
  activities: ActivityItem[];
  emailLogs: EmailLogEntry[];
  billingSummary: LeadBillingSummary | null;
  activeTab: LeadDrawerTab;
  onTabChange: (tab: LeadDrawerTab) => void;
  onOpenPreview: () => void;
  onScored: (score: number) => void;
  onActed: () => void;
}

/**
 * Header + tab nav for `LeadDetailDrawer`. Owns the assignee strip, the
 * quick-action button cluster (Send outreach / connectors / follow-up /
 * score) and the tab buttons. Pure presentational — all state lives in the
 * parent drawer.
 */
export function LeadDetailDrawerHeader({
  lead,
  formName,
  formEmail,
  formPhone,
  effectiveEmail,
  assigneeIds,
  members,
  activities,
  emailLogs,
  billingSummary,
  activeTab,
  onTabChange,
  onOpenPreview,
  onScored,
  onActed,
}: LeadDetailDrawerHeaderProps) {
  const lastOutreachDate = activities.find((a) => a.type === "email")?.date ?? null;
  const lastOutreachLabel = lastOutreachDate ? formatRelativeTime(lastOutreachDate) : null;

  return (
    <>
      <SheetHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <SheetTitle>Lead Details</SheetTitle>
            <SheetDescription>Edit lead information and view activity history.</SheetDescription>
            {assigneeIds.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <AssigneeAvatars
                  assignees={assigneeIds.map((id) => ({
                    user_id: id,
                    full_name: members.find((m) => m.user_id === id)?.full_name ?? "Unnamed",
                  }))}
                  size="sm"
                  max={4}
                />
                <span className="text-[11px] text-muted-foreground">
                  {assigneeIds.length === 1
                    ? "Assigned to 1 employee"
                    : `Shared with ${assigneeIds.length} employees`}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <Button
                variant="command"
                size="sm"
                onClick={onOpenPreview}
                disabled={!effectiveEmail}
                title={
                  effectiveEmail
                    ? "Preview an AI-generated outreach email before sending"
                    : "Add an email address to enable sending"
                }
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Send outreach
              </Button>
              <LeadConnectorActions
                leadId={lead.id}
                leadName={formName || lead.name}
                leadEmail={formEmail.trim() || lead.email || null}
                leadPhone={formPhone.trim() || lead.phone || null}
                onActed={onActed}
              />
              <LeadFollowupButton leadId={lead.id} />
              <LeadScoreButton leadId={lead.id} onScored={onScored} />
            </div>
            {lastOutreachLabel && (
              <span
                className="flex items-center gap-1 text-[10px] text-muted-foreground"
                title={new Date(lastOutreachDate!).toLocaleString()}
              >
                <Clock className="h-3 w-3" />
                Last outreach: {lastOutreachLabel}
              </span>
            )}
          </div>
        </div>
      </SheetHeader>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mt-3">
        <TabButton
          label="Details"
          active={activeTab === "details"}
          onClick={() => onTabChange("details")}
        />
        <TabButton
          label="Activity"
          active={activeTab === "activity"}
          onClick={() => onTabChange("activity")}
          count={activities.length}
        />
        <TabButton
          label="Emails"
          active={activeTab === "emails"}
          onClick={() => onTabChange("emails")}
          count={emailLogs.length}
        />
        <TabButton
          label="Invoices"
          active={activeTab === "invoices"}
          onClick={() => onTabChange("invoices")}
          count={billingSummary?.count ?? 0}
        />
      </div>
    </>
  );
}

function TabButton({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  const showCount = typeof count === "number" && count > 0;
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {showCount && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
          {count}
        </Badge>
      )}
    </button>
  );
}
