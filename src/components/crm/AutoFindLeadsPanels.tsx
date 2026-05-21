// Sub-panels rendered inside AutoFindLeadsDialog at terminal flow states:
// integration-missing → settings CTA, monthly-cap reached → upgrade CTA,
// import-complete → success confirmation. All three share the same shadcn
// Dialog parent — kept here purely so the container stays focused on flow
// orchestration.

import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  KeyRound,
  Plug,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";

export function IntegrationMissingPanel({
  error,
  onReset,
  onCloseDialog,
}: {
  error: string | null;
  onReset: () => void;
  onCloseDialog: () => void;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="rounded-full bg-primary/10 p-3">
          <Plug className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Connect a lead source to start finding leads
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error ?? "We need an Apollo, Hunter, or Snov API key to pull verified contacts."}
        </p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5">
        <p className="font-medium text-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Two ways to get going
        </p>
        <ul className="space-y-1 text-muted-foreground pl-5 list-disc">
          <li>
            <span className="text-foreground font-medium">Add your own key</span> — unlimited
            searches, billed by the provider.
          </li>
          <li>
            <span className="text-foreground font-medium">Use platform credits</span> — comes with
            your plan, no setup needed (Apollo only).
          </li>
        </ul>
      </div>

      <div className="grid gap-2 pt-1">
        <Button variant="command" className="w-full gap-2" asChild>
          <Link to="/settings" onClick={onCloseDialog}>
            <SettingsIcon className="h-4 w-4" />
            Open Settings → Integrations
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Back
        </Button>
      </div>
    </div>
  );
}

export function CapReachedPanel({
  resetLabel,
  capMessage,
  isOwner,
  onReset,
  onCloseDialog,
}: {
  resetLabel: string;
  capMessage: string;
  isOwner: boolean;
  onReset: () => void;
  onCloseDialog: () => void;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="rounded-full bg-warning/10 p-3">
          <Crown className="h-6 w-6 text-warning" />
        </div>
        <h3 className="text-base font-semibold text-foreground">You've hit your monthly cap</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{capMessage}</p>
      </div>

      {/* Explicit retry-window notice */}
      <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-foreground flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
        <div>
          <span className="font-medium">Searches are paused until {resetLabel}.</span>{" "}
          <span className="text-muted-foreground">
            Retrying before then will fail. Upgrade or add your own Apollo key to keep going now.
          </span>
        </div>
      </div>

      <div className="grid gap-2 pt-1">
        <Button variant="command" className="w-full gap-2" asChild>
          <Link to="/pricing" onClick={onCloseDialog}>
            <Crown className="h-4 w-4" />
            Upgrade plan for more credits
          </Link>
        </Button>
        {isOwner && (
          <Button variant="outline" className="w-full gap-2" asChild>
            <Link to="/settings" onClick={onCloseDialog}>
              <KeyRound className="h-4 w-4" />
              Use my own Apollo key (unlimited)
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onReset}>
          Back
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        Credits reset on the 1st of every month.
      </p>
    </div>
  );
}

export function ImportSuccessPanel({
  onFindMore,
  onDone,
}: {
  onFindMore: () => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4 py-6 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
      <p className="text-sm font-medium text-foreground">Leads imported successfully!</p>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" size="sm" onClick={onFindMore}>
          Find More
        </Button>
        <Button variant="command" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
