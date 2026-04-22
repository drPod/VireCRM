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
import { SendTestEmailControl } from "./SendTestEmailControl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ConnectorIntegrations() {
  const { organization, role } = useAuth();
  const isOwner = role?.role === "owner";

  const listConnectors = useAuthedServerFn(listConnectorsFn);
  const enableConnector = useAuthedServerFn(enableConnectorFn);
  const disableConnector = useAuthedServerFn(disableConnectorFn);
  const testConnector = useAuthedServerFn(testConnectorFn);
  const updateConnectorConfig = useAuthedServerFn(updateConnectorConfigFn);

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
      try {
        await disableConnector({ data: { organizationId: organization.id, provider } });
        toast.success(`${name} disconnected`);
        void refresh();
      } catch (err) {
        toast.error("Couldn't disconnect", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        throw err;
      }
    },
    [organization?.id, disableConnector, refresh],
  );

  const handleTest = useCallback(
    async (provider: string, name: string) => {
      if (!organization?.id) return;
      try {
        const res = await testConnector({
          data: { organizationId: organization.id, provider },
        });
        if (res.ok) {
          toast.success(`${name} is working`, {
            description: "Credentials verified successfully.",
          });
        } else {
          toast.error(`${name} test failed`, {
            description: res.reason ?? "No response from gateway.",
          });
        }
        void refresh();
      } catch (err) {
        toast.error("Test failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [organization?.id, testConnector, refresh],
  );

  const handleSaveConfig = useCallback(
    async (provider: string, config: Record<string, string>) => {
      if (!organization?.id) return;
      await updateConnectorConfig({
        data: { organizationId: organization.id, provider, config },
      });
      void refresh();
    },
    [organization?.id, updateConnectorConfig, refresh],
  );

  if (!isOwner) return null; // Owner-only — the BYO section already renders the "owners only" card.

  const grouped: Record<ConnectorCategory, ConnectorMeta[]> = {
    email_calendar: [],
    communication: [],
    crm_data: [],
    productivity: [],
  };
  for (const c of CONNECTORS) grouped[c.category].push(c);

  const connectedCount = Object.values(statuses).filter(
    (s) => s.enabled && s.credentialPresent,
  ).length;
  const totalCount = CONNECTORS.length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Plug className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-base font-semibold text-foreground">
                One-click integrations
              </h3>
              {!loading && (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  {connectedCount} of {totalCount} connected
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect tools your team already uses — no API keys to copy or paste. Just click
              <span className="font-medium text-foreground"> Connect </span>
              on any card below and sign in to that service when prompted. We handle the
              technical setup automatically.
            </p>
          </div>
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
                onTest={() => handleTest(meta.id, meta.name)}
                onSaveConfig={(config) => handleSaveConfig(meta.id, config)}
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
  onTest: () => Promise<void>;
  onSaveConfig: (config: Record<string, string>) => Promise<void>;
  organizationId: string | null;
}

function ConnectorRow({
  meta,
  status,
  loading,
  onEnable,
  onDisable,
  onTest,
  onSaveConfig,
  organizationId,
}: ConnectorRowProps) {
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [draftConfig, setDraftConfig] = useState<Record<string, string>>({});
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const importHubspot = useAuthedServerFn(importHubspotContactsFn);

  const enabled = !!status?.enabled;
  const credentialPresent = !!status?.credentialPresent;
  const verified = status?.verified;
  const hasConfigFields = (meta.configFields ?? []).length > 0;

  const handleEnable = async () => {
    setBusy(true);
    try {
      await onEnable();
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await onDisable();
      setConfirmDisconnect(false);
    } catch {
      // toast already shown upstream
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await onTest();
    } finally {
      setTesting(false);
    }
  };

  const openEditor = () => {
    // Seed draft from the saved config (cast values to strings for inputs).
    const seed: Record<string, string> = {};
    for (const f of meta.configFields ?? []) {
      const v = status?.config?.[f.key];
      seed[f.key] = v == null ? "" : String(v);
    }
    setDraftConfig(seed);
    setEditing(true);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await onSaveConfig(draftConfig);
      toast.success(`${meta.name} settings saved`);
      setEditing(false);
    } catch (err) {
      toast.error("Couldn't save settings", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSavingConfig(false);
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

      {/* Inline config editor */}
      {enabled && editing && hasConfigFields && (
        <div className="space-y-3 mb-3 p-3 rounded-md bg-secondary/30 border border-border">
          {(meta.configFields ?? []).map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="block text-[11px] font-medium text-foreground">{f.label}</label>
              <input
                value={draftConfig[f.key] ?? ""}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
                placeholder={f.placeholder}
                className="h-8 w-full rounded-md border border-input bg-input px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                spellCheck={false}
              />
              {f.helper && (
                <p className="text-[10px] text-muted-foreground">{f.helper}</p>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              variant="command"
              size="sm"
              onClick={handleSaveConfig}
              disabled={savingConfig}
            >
              {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={savingConfig}>
              Cancel
            </Button>
          </div>
        </div>
      )}

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
              <Button
                variant="outline"
                size="sm"
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const limitRaw = status?.config?.importLimit;
                    const limit =
                      typeof limitRaw === "string"
                        ? parseInt(limitRaw, 10)
                        : typeof limitRaw === "number"
                          ? limitRaw
                          : 25;
                    const res = await importHubspot({
                      data: {
                        organizationId,
                        limit: Number.isFinite(limit) && limit > 0 ? limit : 25,
                      },
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
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Activity className="h-3.5 w-3.5" />
              )}
              Test
            </Button>
            {hasConfigFields && !editing && (
              <Button variant="outline" size="sm" onClick={openEditor}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDisconnect(true)}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            variant="command"
            size="sm"
            onClick={handleEnable}
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

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {meta.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Outbound actions through {meta.name} will stop working until you reconnect. Your
              {meta.name} account itself isn't touched — you can reconnect any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep connected</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisable} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Disconnecting…
                </>
              ) : (
                "Yes, disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
