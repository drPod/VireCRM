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
import { useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { useConnectorStatus } from "@/hooks/useConnectorStatus";
import {
  enableConnectorFn,
  disableConnectorFn,
  testConnectorFn,
  updateConnectorConfigFn,
} from "@/functions/connectors.functions";
import { CONNECTORS, type ConnectorCategory, type ConnectorMeta } from "@/lib/connectors/catalog";
import { buildConnectorConnectPrompt } from "@/lib/connectors/ai-prompt";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Plug } from "lucide-react";
import { toast } from "sonner";
import type { TestResult } from "./TestResultPanel";
import { ConnectorCategorySection } from "./ConnectorCategorySection";

export function ConnectorIntegrations() {
  const { organization, role } = useAuth();
  const isOwner = role?.role === "owner";

  const enableConnector = useAuthedServerFn(enableConnectorFn);
  const disableConnector = useAuthedServerFn(disableConnectorFn);
  const testConnector = useAuthedServerFn(testConnectorFn);
  const updateConnectorConfig = useAuthedServerFn(updateConnectorConfigFn);

  const { statuses, setStatuses, loading, refresh } = useConnectorStatus({
    organizationId: organization?.id,
    isOwner,
  });

  const handleEnable = useCallback(
    async (provider: string) => {
      if (!organization?.id) return;
      try {
        const res = await enableConnector({
          data: { organizationId: organization.id, provider },
        });
        const meta = CONNECTORS.find((c) => c.id === provider);
        if (res.credentialPresent) {
          toast.success(`${meta?.name ?? "Integration"} connected`, {
            description: "Credentials are live — you can use it right away.",
          });
        } else {
          // Auto-copy the AI prompt to the clipboard so the user has zero
          // friction finishing the OAuth handshake. The card will flip to
          // "Connected" automatically the moment the gateway env var arrives.
          const prompt = buildConnectorConnectPrompt({
            connectorId: meta?.connectorId ?? provider,
            providerLabel: meta?.name ?? "this integration",
          });
          try {
            await navigator.clipboard.writeText(prompt);
            toast.success(`${meta?.name ?? "Integration"} ready to authorize`, {
              description:
                "We copied a one-line prompt to your clipboard. Paste it into your AI assistant chat to finish sign-in — this card will flip to Connected automatically.",
              duration: 7000,
            });
          } catch {
            toast.info(`${meta?.name ?? "Integration"} ready to authorize`, {
              description:
                "Use the 'Copy AI prompt' button on the card and paste it into your AI assistant chat to finish sign-in.",
              duration: 7000,
            });
          }
        }
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
      // Snapshot for rollback if the call fails.
      const previous = statuses[provider];
      // Optimistically reflect "disconnected" in the card immediately so the
      // user gets instant feedback without waiting for the round-trip.
      setStatuses((prev) => ({
        ...prev,
        [provider]: {
          ...(prev[provider] ?? {
            id: provider,
            enabled: false,
            credentialPresent: false,
            verified: null,
            verifyError: null,
            config: {},
            enabledAt: null,
          }),
          enabled: false,
          verified: null,
          verifyError: null,
          config: {},
        },
      }));
      try {
        const res = await disableConnector({ data: { organizationId: organization.id, provider } });
        if (res.revoked) {
          toast.success(`${name} disconnected`, {
            description: "Access revoked. Reconnect any time to start again.",
          });
        } else {
          toast.warning(`${name} disconnected`, {
            description: `Local state cleared, but the provider revoke step reported: ${res.revokeError ?? "unknown error"}`,
          });
        }
        // Re-sync from the server so credentialPresent / verified reflect reality.
        void refresh();
      } catch (err) {
        // Roll back the optimistic update.
        if (previous) {
          setStatuses((prev) => ({ ...prev, [provider]: previous }));
        }
        toast.error("Couldn't disconnect", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        throw err;
      }
    },
    [organization?.id, disableConnector, refresh, statuses, setStatuses],
  );

  const handleTest = useCallback(
    async (provider: string, name: string): Promise<TestResult> => {
      const ranAt = new Date().toISOString();
      if (!organization?.id) {
        return { ok: false, reason: "No organization context.", verifiedAt: ranAt };
      }
      try {
        const res = await testConnector({
          data: { organizationId: organization.id, provider },
        });
        if (res.ok) {
          toast.success(`${name} is working`, {
            description: "Credentials verified successfully.",
          });
          void refresh();
          return { ok: true, verifiedAt: ranAt };
        }
        const reason = res.reason ?? "No response from gateway.";
        toast.error(`${name} test failed`, { description: reason });
        void refresh();
        return { ok: false, reason, verifiedAt: ranAt };
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Unknown error";
        toast.error("Test failed", { description: reason });
        return { ok: false, reason, verifiedAt: ranAt };
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
              <h3 className="text-base font-semibold text-foreground">One-click integrations</h3>
              {!loading && (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  {connectedCount} of {totalCount} connected
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect tools your team already uses — no API keys to copy or paste.
            </p>
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground list-decimal pl-4">
              <li>
                Click <span className="font-medium text-foreground">Connect</span> on any card to
                enable it for your workspace.
              </li>
              <li>
                A sign-in window for that provider will open — finish the sign-in to authorize
                access. The card flips to
                <span className="font-medium text-foreground"> Connected </span> automatically
                (usually within a few seconds).
              </li>
              <li>
                If a window doesn't open, use the{" "}
                <span className="font-medium text-foreground">"Ask AI to finish setup"</span> button
                on the card to copy a ready-made prompt for your AI assistant.
              </li>
            </ol>
          </div>
        </div>
      </div>

      {(Object.keys(grouped) as ConnectorCategory[]).map((cat) => (
        <ConnectorCategorySection
          key={cat}
          category={cat}
          connectors={grouped[cat]}
          statuses={statuses}
          loading={loading}
          organizationId={organization?.id ?? null}
          onEnable={handleEnable}
          onDisable={handleDisable}
          onTest={handleTest}
          onSaveConfig={handleSaveConfig}
        />
      ))}
    </div>
  );
}
