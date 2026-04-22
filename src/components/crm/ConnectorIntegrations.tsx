/**
 * UI for managing one-click connector integrations (Slack, Gmail, HubSpot, etc.).
 *
 * Unlike the BYO key cards (Apollo / Hunter / Snov), connectors don't store
 * API keys in our DB — credentials live in the Lovable Connector Gateway.
 * Owners click "Connect" → an external OAuth flow opens → the gateway
 * injects the resulting key as a server env var. We just track a small row
 * in `org_connectors` recording that the org has enabled it.
 *
 * Because the OAuth flow is started from the agent (standard_connectors--connect),
 * end-users in production click "I've already connected it" after the
 * workspace owner has linked it once. For dev/preview, owners can flip the
 * toggle directly to test wiring.
 */
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  listConnectorsFn,
  enableConnectorFn,
  disableConnectorFn,
  testConnectorFn,
  updateConnectorConfigFn,
  type ConnectorStatus,
} from "@/functions/connectors.functions";
import { importHubspotContactsFn } from "@/functions/connector-actions.functions";
import {
  CONNECTORS,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type ConnectorCategory,
  type ConnectorMeta,
} from "@/lib/connectors/catalog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Loader2,
  ExternalLink,
  Plug,
  AlertTriangle,
  Power,
  Download,
  Activity,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

export function ConnectorIntegrations() {
  const { organization, role } = useAuth();
  const isOwner = role?.role === "owner";

  const listConnectors = useAuthedServerFn(listConnectorsFn);
  const enableConnector = useAuthedServerFn(enableConnectorFn);
  const disableConnector = useAuthedServerFn(disableConnectorFn);

  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, ConnectorStatus>>({});

  const refresh = useCallback(async () => {
    if (!organization?.id || !isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listConnectors({ data: { organizationId: organization.id } });
      const map: Record<string, ConnectorStatus> = {};
      for (const s of res.statuses) map[s.id] = s;
      setStatuses(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, isOwner, listConnectors]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleEnable = useCallback(
    async (provider: string) => {
      if (!organization?.id) return;
      try {
        const res = await enableConnector({
          data: { organizationId: organization.id, provider },
        });
        toast.success("Integration enabled", {
          description: res.credentialPresent
            ? "We can now reach this provider on your behalf."
            : "Marked as enabled. Have your workspace owner link the connection so we can authenticate.",
        });
        void refresh();
      } catch (err) {
        toast.error("Couldn't enable", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [organization?.id, enableConnector, refresh],
  );

  const handleDisable = useCallback(
    async (provider: string, name: string) => {
      if (!organization?.id) return;
      if (!confirm(`Disable ${name}? Outbound actions through ${name} will stop working.`)) return;
      try {
        await disableConnector({ data: { organizationId: organization.id, provider } });
        toast.success(`${name} disabled`);
        void refresh();
      } catch (err) {
        toast.error("Couldn't disable", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [organization?.id, disableConnector, refresh],
  );

  if (!isOwner) return null; // Owner-only — the BYO section already renders the "owners only" card.

  const grouped: Record<ConnectorCategory, ConnectorMeta[]> = {
    email_calendar: [],
    communication: [],
    crm_data: [],
    productivity: [],
  };
  for (const c of CONNECTORS) grouped[c.category].push(c);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Plug className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <h3 className="text-base font-semibold text-foreground">One-click integrations</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect the tools your team already uses — no API keys to copy. Your tokens are
            managed by Lovable's connector gateway and refreshed automatically.
          </p>
        </div>
      </div>

      {(Object.keys(grouped) as ConnectorCategory[]).map((cat) => (
        <div key={cat} className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">{CATEGORY_LABELS[cat]}</h4>
            <p className="text-xs text-muted-foreground">{CATEGORY_DESCRIPTIONS[cat]}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {grouped[cat].map((meta) => (
              <ConnectorRow
                key={meta.id}
                meta={meta}
                status={statuses[meta.id]}
                loading={loading}
                onEnable={() => handleEnable(meta.id)}
                onDisable={() => handleDisable(meta.id, meta.name)}
                organizationId={organization?.id ?? null}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ConnectorRowProps {
  meta: ConnectorMeta;
  status: ConnectorStatus | undefined;
  loading: boolean;
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
  organizationId: string | null;
}

function ConnectorRow({ meta, status, loading, onEnable, onDisable, organizationId }: ConnectorRowProps) {
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const importHubspot = useAuthedServerFn(importHubspotContactsFn);

  const enabled = !!status?.enabled;
  const credentialPresent = !!status?.credentialPresent;
  const verified = status?.verified;

  const handleClick = async (action: "enable" | "disable") => {
    setBusy(true);
    try {
      if (action === "enable") await onEnable();
      else await onDisable();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="text-sm font-semibold text-foreground">{meta.name}</h5>
            {meta.status === "beta" && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                Beta
              </Badge>
            )}
            {!loading && enabled ? (
              verified === true ? (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Connected
                </Badge>
              ) : verified === false ? (
                <Badge variant="outline" className="gap-1 text-[10px] border-warning/50 text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  Reconnect
                </Badge>
              ) : credentialPresent ? (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[10px] border-warning/50 text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  Awaiting auth
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="text-[10px]">Not connected</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      {status?.verifyError && (
        <p className="text-[11px] text-warning mb-2">{status.verifyError}</p>
      )}

      <div className="flex items-center justify-between gap-2">
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
          <div className="flex items-center gap-2">
            {meta.id === "hubspot" && organizationId && (
              <Button
                variant="outline"
                size="sm"
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const res = await importHubspot({
                      data: { organizationId, limit: 25 },
                    });
                    toast.success("HubSpot sync complete", {
                      description: `Imported ${res.inserted} new lead${res.inserted === 1 ? "" : "s"} (${res.skipped} skipped).`,
                    });
                  } catch (err) {
                    toast.error("Sync failed", {
                      description: err instanceof Error ? err.message : "Unknown error",
                    });
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                {syncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Sync contacts
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleClick("disable")}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
              Disable
            </Button>
          </div>
        ) : (
          <Button
            variant="command"
            size="sm"
            onClick={() => handleClick("enable")}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plug className="h-3.5 w-3.5" />
            )}
            Connect
          </Button>
        )}
      </div>
    </Card>
  );
}
