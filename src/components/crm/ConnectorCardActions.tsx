import { Loader2, ExternalLink, Plug, Power, Activity, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConnectorStatus } from "@/functions/connectors.functions";
import type { ConnectorMeta } from "@/lib/connectors/catalog";
import { HubspotSyncButton } from "./HubspotSyncButton";

interface ConnectorCardActionsProps {
  meta: ConnectorMeta;
  status: ConnectorStatus | undefined;
  loading: boolean;
  enabled: boolean;
  busy: boolean;
  testing: boolean;
  testLocked: boolean;
  editing: boolean;
  hasConfigFields: boolean;
  organizationId: string | null;
  onEnable: () => void;
  onTest: () => void;
  onEdit: () => void;
  onAskDisconnect: () => void;
}

export function ConnectorCardActions({
  meta,
  status,
  loading,
  enabled,
  busy,
  testing,
  testLocked,
  editing,
  hasConfigFields,
  organizationId,
  onEnable,
  onTest,
  onEdit,
  onAskDisconnect,
}: ConnectorCardActionsProps) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <a
        href={meta.docsUrl}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] text-primary hover:underline flex items-center gap-1"
      >
        Provider docs <ExternalLink className="h-3 w-3" />
      </a>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : enabled ? (
        <div className="flex items-center gap-2 flex-wrap">
          {meta.id === "hubspot" && organizationId && (
            <HubspotSyncButton
              organizationId={organizationId}
              importLimit={status?.config?.importLimit}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onTest}
            disabled={testLocked}
            aria-busy={testing}
          >
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Activity className="h-3.5 w-3.5" />
            )}
            Test
          </Button>
          {hasConfigFields && !editing && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onAskDisconnect} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
            Disconnect
          </Button>
        </div>
      ) : (
        <Button variant="command" size="sm" onClick={onEnable} disabled={busy}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plug className="h-3.5 w-3.5" />
          )}
          Connect
        </Button>
      )}
    </div>
  );
}
