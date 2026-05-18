import { useState } from "react";
import { EyeOff, Info, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ViewBannerCopy {
  simulated: string;
  disabled: string;
}

const VIEW_BANNER_COPY: Record<string, ViewBannerCopy> = {
  dashboard: {
    simulated: "Metrics, pipeline counts, hot leads, and the live activity feed are sample data.",
    disabled: "Creating leads, drilling into records, and exporting are turned off.",
  },
  leads: {
    simulated: "Lead list, scores, and statuses are demo records.",
    disabled: "Adding, editing, importing, and assigning leads are disabled.",
  },
  messages: {
    simulated: "Conversations, replies, and AI sentiment are placeholder content.",
    disabled: "Sending email or SMS, and triggering AI replies are disabled.",
  },
  campaigns: {
    simulated: "Campaign cards and performance numbers are sample data.",
    disabled: "Launching, pausing, or editing campaigns is disabled.",
  },
  workflows: {
    simulated: "Workflow templates are illustrative only.",
    disabled: "Building, running, and enrolling leads in workflows are disabled.",
  },
  calendar: {
    simulated: "Bookings and availability are demo entries.",
    disabled: "Creating events and syncing calendars are disabled.",
  },
  email: {
    simulated: "Email lists and sequences are sample data.",
    disabled: "Sending broadcasts or scheduling sends is disabled.",
  },
  revenue: {
    simulated: "Revenue charts and totals are simulated.",
    disabled: "Recording or adjusting revenue entries is disabled.",
  },
  payouts: {
    simulated: "Payout history and pending balances are sample.",
    disabled: "Initiating payouts and editing recipients are disabled.",
  },
  expenses: {
    simulated: "Expense entries are demo data.",
    disabled: "Adding, editing, and deleting expenses are disabled.",
  },
  reputation: {
    simulated: "Reviews and rating breakdowns are placeholder content.",
    disabled: "Requesting reviews or replying to them is disabled.",
  },
  advisor: {
    simulated: "AI insights and recommendations shown here are illustrative.",
    disabled: "Running new analyses, executing AI actions, and saving plans are disabled.",
  },
  analytics: {
    simulated: "Charts and reports use seeded numbers.",
    disabled: "Creating custom reports and exporting are disabled.",
  },
  billing: {
    simulated: "The plan and invoice history are demo content.",
    disabled:
      "Subscribing, upgrading, and managing payment methods happen on the live signup flow.",
  },
};

export function PreviewViewBanner({ viewId, label }: { viewId: string; label: string }) {
  const copy = VIEW_BANNER_COPY[viewId] ?? {
    simulated: `${label} content shown here is sample data.`,
    disabled: "All actions on this page are disabled in the preview.",
  };
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-label={`${label} preview notice`}
      className="flex items-start gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-[oklch(0.65_0.16_320)]/10 p-4 shadow-sm"
    >
      <div className="mt-0.5 rounded-lg bg-primary/15 p-1.5 text-primary">
        <Info className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            You're previewing {label} in read-only mode.
          </p>
          <Badge
            variant="outline"
            className="gap-1 border-primary/40 bg-primary/10 text-[10px] uppercase tracking-wide text-primary"
          >
            <EyeOff className="h-3 w-3" /> No data is saved
          </Badge>
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground sm:text-sm">
          <li>
            <span className="font-medium text-foreground/80">Simulated:</span> {copy.simulated}
          </li>
          <li>
            <span className="font-medium text-foreground/80">Disabled:</span> {copy.disabled}
          </li>
        </ul>
      </div>
      <button
        type="button"
        aria-label="Dismiss preview notice"
        data-preview-allow="true"
        onClick={() => setDismissed(true)}
        className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
