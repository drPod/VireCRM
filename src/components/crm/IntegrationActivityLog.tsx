/**
 * Integrations → Activity tab.
 *
 * Renders a chronological feed of recent connector actions for the current
 * organization: connect/disconnect/reconnect, test verifications, config
 * updates, and outbound actions like sending email/SMS or syncing contacts.
 *
 * Pulled from `connector_activity_log` via `listConnectorActivityFn`. Visible
 * to any org member — not just owners — so non-admin team members can see
 * "did the Slack post actually go out?" without bothering an owner.
 *
 * Polls every 15s while the tab is mounted so freshly-triggered actions
 * (e.g. a Test click on the cards above) show up without a manual refresh.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useServerFn } from "@tanstack/react-start";
import {
  listConnectorActivityFn,
  type ConnectorActivityEntry,
} from "@/functions/connectors.functions";
import { CONNECTORS } from "@/lib/connectors/catalog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Plug,
  PlugZap,
  Power,
  Settings as SettingsIcon,
  Send,
  Download,
  RefreshCw,
} from "lucide-react";

const PROVIDER_NAMES: Record<string, string> = Object.fromEntries(
  CONNECTORS.map((c) => [c.id, c.name]),
);

// Friendly labels for the `action` column. Falls back to a Title-Cased
// version of the raw key for any action we haven't explicitly mapped.
const ACTION_LABELS: Record<string, string> = {
  connect: "Connected",
  reconnect: "Re-enabled",
  disconnect: "Disconnected",
  test: "Tested credentials",
  config_update: "Updated settings",
  send_message: "Sent message",
  send_email: "Sent email",
  send_sms: "Sent SMS",
  sync_contacts: "Synced contacts",
  sync_messages: "Synced messages",
  create_task: "Created task",
};

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function ActionIcon({ action }: { action: string }) {
  const cls = "h-3.5 w-3.5";
  switch (action) {
    case "connect":
    case "reconnect":
      return <PlugZap className={cls} />;
    case "disconnect":
      return <Power className={cls} />;
    case "test":
      return <RefreshCw className={cls} />;
    case "config_update":
      return <SettingsIcon className={cls} />;
    case "send_email":
    case "send_message":
    case "send_sms":
      return <Send className={cls} />;
    case "sync_contacts":
    case "sync_messages":
      return <Download className={cls} />;
    default:
      return <Plug className={cls} />;
  }
}

function StatusPill({ status }: { status: ConnectorActivityEntry["status"] }) {
  if (status === "success") {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px] py-0 px-1.5 h-4">
        <CheckCircle2 className="h-3 w-3 text-success" />
        Success
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge
        variant="outline"
        className="gap-1 text-[10px] py-0 px-1.5 h-4 border-warning/50 text-warning"
      >
        <AlertTriangle className="h-3 w-3" />
        Partial
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 text-[10px] py-0 px-1.5 h-4 border-destructive/50 text-destructive"
    >
      <AlertCircle className="h-3 w-3" />
      Failed
    </Badge>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function IntegrationActivityLog() {
  const { organization } = useAuth();
  const listActivity = useServerFn(listConnectorActivityFn);

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ConnectorActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    try {
      setError(null);
      const res = await listActivity({ data: { organizationId: organization.id } });
      setEntries(res.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load activity.");
    } finally {
      setLoading(false);
    }
  }, [organization?.id, listActivity]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Light polling so a Test/Connect action on the cards above shows up here
  // within a few seconds. Pauses while the tab is hidden.
  useEffect(() => {
    if (!organization?.id) return;
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [organization?.id, refresh]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Integration activity</h3>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-xs text-primary hover:underline flex items-center gap-1"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Refresh
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Recent connector actions across your team — connections, tests, settings updates, and
        outbound messages. The 50 most recent events are shown.
      </p>

      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/30 p-6 text-center">
          <Activity className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-foreground font-medium">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Once you connect a provider or send a test, the events will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((e) => {
            const providerName = PROVIDER_NAMES[e.provider] ?? e.provider;
            return (
              <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <ActionIcon action={e.action} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {actionLabel(e.action)}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-foreground">{providerName}</span>
                      <StatusPill status={e.status} />
                      {e.direction === "inbound" && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                          Incoming
                        </Badge>
                      )}
                    </div>
                    {e.summary && (
                      <p className="mt-0.5 text-xs text-muted-foreground break-words">
                        {e.summary}
                      </p>
                    )}
                    {e.errorMessage && (
                      <p className="mt-1 text-[11px] text-destructive break-words">
                        {e.errorMessage}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span title={new Date(e.createdAt).toLocaleString()}>
                        {formatRelative(e.createdAt)}
                      </span>
                      {e.actorName && (
                        <>
                          <span>·</span>
                          <span>by {e.actorName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
