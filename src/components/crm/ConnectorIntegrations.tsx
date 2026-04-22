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
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { useActionLock } from "@/hooks/useActionLock";
import {
  listConnectorsFn,
  enableConnectorFn,
  disableConnectorFn,
  testConnectorFn,
  updateConnectorConfigFn,
  refreshConnectorStatusFn,
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
import { validateDraft, FIELD_RULES } from "@/lib/connectors/validation";
import { deriveConnectorPrerequisites } from "@/lib/connectors/prerequisites";
import { PrerequisitesPanel } from "./PrerequisitesPanel";
import { VerifiedExplainer } from "./VerifiedExplainer";
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
  Copy,
  Sparkles,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { SendTestEmailControl } from "./SendTestEmailControl";
import { TestResultPanel, type TestResult } from "./TestResultPanel";
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
  const refreshConnectorStatus = useAuthedServerFn(refreshConnectorStatusFn);

  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, ConnectorStatus>>({});
  // Tracks which providers we've already toasted "Connected" for, so the
  // background poller doesn't re-toast on every successful refresh.
  const toastedConnectedRef = useRef<Set<string>>(new Set());

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
      // Seed the "already toasted" set with anything that's currently
      // connected, so the poller doesn't fire a toast on first load.
      for (const s of res.statuses) {
        if (s.enabled && s.credentialPresent && s.verified === true) {
          toastedConnectedRef.current.add(s.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, isOwner, listConnectors]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Background poller: any provider that's enabled but still missing its
  // gateway credentials (or, for Gmail, missing the discovered connectedEmail)
  // gets re-checked periodically. As soon as the gateway has injected the env
  // var, the row will swap to "Connected" without a manual reload.
  //
  // Polling cadence: every 4s for the first minute, then every 12s, capped
  // at 5 minutes total. We only poll while the page is visible — when the
  // user switches tabs we pause to avoid wasted network calls.
  useEffect(() => {
    if (!organization?.id || !isOwner) return;

    const pendingProviders = () =>
      Object.values(statuses)
        .filter((s) => {
          if (!s.enabled) return false;
          // Awaiting auth: enabled but the gateway env var hasn't appeared yet.
          if (!s.credentialPresent) return true;
          // Verify failed mid-flight — keep polling, the gateway may still be
          // refreshing the token.
          if (s.verified === false) return true;
          // Google connectors: credentials are there but we haven't
          // discovered the connected account email yet. Worth one more
          // refresh to populate it.
          if (
            (s.id === "gmail" || s.id === "google_calendar") &&
            s.verified === true &&
            !s.config?.connectedEmail
          ) {
            return true;
          }
          return false;
        })
        .map((s) => s.id);

    if (pendingProviders().length === 0) return;

    const startedAt = Date.now();
    const MAX_DURATION_MS = 5 * 60 * 1000;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (document.hidden) {
        // Page not visible — try again soon without hitting the network.
        timer = setTimeout(tick, 4000);
        return;
      }
      const providers = pendingProviders();
      if (providers.length === 0 || Date.now() - startedAt > MAX_DURATION_MS) {
        return;
      }

      await Promise.all(
        providers.map(async (provider) => {
          try {
            const { status } = await refreshConnectorStatus({
              data: { organizationId: organization.id, provider },
            });
            if (cancelled) return;
            setStatuses((prev) => ({ ...prev, [provider]: status }));

            // Surface a toast the first time a pending connector goes live.
            const becameConnected =
              status.enabled && status.credentialPresent && status.verified === true;
            if (becameConnected && !toastedConnectedRef.current.has(provider)) {
              toastedConnectedRef.current.add(provider);
              const meta = CONNECTORS.find((c) => c.id === provider);
              const email =
                (provider === "gmail" || provider === "google_calendar") &&
                typeof status.config?.connectedEmail === "string"
                  ? (status.config.connectedEmail as string)
                  : null;
              toast.success(`${meta?.name ?? provider} connected`, {
                description: email
                  ? `Connected as ${email}.`
                  : "Credentials are live and verified.",
              });
            }
          } catch {
            // Swallow — next tick will retry.
          }
        }),
      );

      const elapsed = Date.now() - startedAt;
      const interval = elapsed < 60_000 ? 4000 : 12000;
      timer = setTimeout(tick, interval);
    };

    timer = setTimeout(tick, 4000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [organization?.id, isOwner, statuses, refreshConnectorStatus]);

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
    [organization?.id, disableConnector, refresh, statuses],
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
              Connect tools your team already uses — no API keys to copy or paste.
            </p>
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground list-decimal pl-4">
              <li>
                Click <span className="font-medium text-foreground">Connect</span> on any card to enable it for your workspace.
              </li>
              <li>
                A sign-in window for that provider will open — finish the sign-in to authorize access. The card flips to
                <span className="font-medium text-foreground"> Connected </span> automatically (usually within a few seconds).
              </li>
              <li>
                If a window doesn't open, use the <span className="font-medium text-foreground">"Ask AI to finish setup"</span> button on the card to copy a ready-made prompt for your AI assistant.
              </li>
            </ol>
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
  onTest: () => Promise<TestResult>;
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
  // `testing` is now derived from useActionLock below.
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [draftConfig, setDraftConfig] = useState<Record<string, string>>({});
  // Tracks which fields the user has interacted with so on-blur validation
  // doesn't shout at them while they're still typing the first character.
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
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

  // Single-flight lock prevents repeated Test clicks from firing parallel
  // verifications. The button stays disabled while a request is in flight
  // and for a short cooldown after, so impatient double-clicks coalesce.
  const testLock = useActionLock();
  const testing = testLock.loading;
  // Latest Test result, surfaced inline next to the buttons. Seeded from
  // the server's last verify state on mount so the panel isn't empty after
  // a page refresh while a previous error/success is still meaningful.
  const seedFromStatus = (): TestResult | null => {
    if (status?.verified === true) {
      return { ok: true, verifiedAt: status.enabledAt ?? new Date().toISOString() };
    }
    if (status?.verified === false && status.verifyError) {
      return {
        ok: false,
        reason: status.verifyError,
        verifiedAt: status.enabledAt ?? new Date().toISOString(),
      };
    }
    return null;
  };
  const [testResult, setTestResult] = useState<TestResult | null>(seedFromStatus);

  // Re-sync from status when the background poller updates verifyError /
  // verified — but only if we don't have a fresher local Test result.
  useEffect(() => {
    const fromStatus = seedFromStatus();
    if (!fromStatus) return;
    setTestResult((prev) => {
      if (!prev) return fromStatus;
      // Keep the local result if it's newer than what the poller knows.
      if (new Date(prev.verifiedAt).getTime() >= new Date(fromStatus.verifiedAt).getTime()) {
        return prev;
      }
      return fromStatus;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.verified, status?.verifyError]);

  const handleTest = async () => {
    await testLock.run(async () => {
      const res = await onTest();
      setTestResult(res);
    });
  };

  const openEditor = () => {
    // Seed draft from the saved config (cast values to strings for inputs).
    const seed: Record<string, string> = {};
    for (const f of meta.configFields ?? []) {
      const v = status?.config?.[f.key];
      seed[f.key] = v == null ? "" : String(v);
    }
    setDraftConfig(seed);
    // Reset touched state — a fresh editor session shouldn't inherit blur
    // history from a prior open/cancel cycle.
    setTouchedFields({});
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
            {/* Inline help — explains what "Verified" / "Connected" actually
                means for a one-click connector (gateway token refresh + a
                successful provider call). */}
            <VerifiedExplainer variant="connector" providerLabel={meta.name} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
          {enabled &&
            (meta.id === "gmail" || meta.id === "google_calendar") &&
            typeof status?.config?.connectedEmail === "string" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Connected as{" "}
                <span className="font-medium text-foreground">
                  {String(status.config.connectedEmail)}
                </span>
              </p>
            )}
        </div>
      </div>

      {/* Awaiting-auth helper — when the row is enabled but the gateway hasn't
          injected credentials yet, surface a clear, copyable AI prompt so the
          user knows exactly how to finish the OAuth handshake. */}
      {!loading && enabled && !credentialPresent && (
        <AwaitingAuthHelper providerLabel={meta.name} connectorId={meta.connectorId} />
      )}

      {!loading && (() => {
        // While editing, feed the in-progress draft so the prerequisites
        // panel updates live (e.g. "Send-from address is required" disappears
        // the moment the user types a valid email — no save needed).
        const prereqs = deriveConnectorPrerequisites(
          meta,
          status,
          editing ? draftConfig : null,
        );
        if (prereqs.length === 0) return null;
        return (
          <div className="mb-3">
            <PrerequisitesPanel
              prerequisites={prereqs}
              providerLabel={meta.name}
              verification={{
                // Prefer the freshest signal: an in-memory test run beats the
                // last server-known timestamp. enabledAt is the fallback so
                // newly-enabled cards still show *something* useful.
                lastVerifiedAt:
                  testResult?.verifiedAt ?? status?.enabledAt ?? null,
                outcome:
                  testResult
                    ? testResult.ok
                      ? "ok"
                      : "failed"
                    : status?.verified === true
                      ? "ok"
                      : status?.verified === false
                        ? "failed"
                        : "unknown",
                failureReason:
                  testResult && !testResult.ok
                    ? (testResult.reason ?? null)
                    : (status?.verifyError ?? null),
              }}
              onAction={async (p) => {
                switch (p.actionId) {
                  case "connect":
                    await handleEnable();
                    break;
                  case "reconnect":
                    // Re-trigger the enable flow — for OAuth connectors this
                    // re-runs the gateway's connect handshake.
                    await handleEnable();
                    toast.info(`Finish ${meta.name} sign-in`, {
                      description:
                        "If a provider window didn't open, your workspace owner needs to approve the connection.",
                    });
                    break;
                  case "test":
                    await handleTest();
                    break;
                  case "edit-config":
                    if (hasConfigFields) openEditor();
                    break;
                  case "open-docs":
                    window.open(meta.docsUrl, "_blank", "noopener,noreferrer");
                    break;
                  default:
                    break;
                }
              }}
            />
          </div>
        );
      })()}

      {(testResult || testing) && (
        <div className="mb-3">
          <TestResultPanel result={testResult} testing={testing} providerLabel={meta.name} />
        </div>
      )}

      {/* Inline config editor */}
      {enabled && editing && hasConfigFields && (() => {
        const { errors: fieldErrors, valid: draftValid } = validateDraft(
          meta.id,
          meta.configFields ?? [],
          draftConfig,
        );
        return (
        <div className="space-y-3 mb-3 p-3 rounded-md bg-secondary/30 border border-border">
          {(meta.configFields ?? []).map((f) => {
            const ruleKey = `${meta.id}.${f.key}`;
            const rule = FIELD_RULES[ruleKey];
            const rawErr = fieldErrors[f.key];
            // Only surface the inline error after the user has blurred the
            // field at least once — keeps the UI quiet while they type the
            // first character, but updates instantly on subsequent edits.
            const err = touchedFields[f.key] ? rawErr : null;
            return (
              <div key={f.key} className="space-y-1">
                <label className="block text-[11px] font-medium text-foreground">
                  {f.label}
                  {rule?.required && (
                    <span className="text-destructive ml-0.5" aria-hidden="true">
                      *
                    </span>
                  )}
                </label>
                <input
                  value={draftConfig[f.key] ?? ""}
                  onChange={(e) =>
                    setDraftConfig((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  onBlur={() =>
                    setTouchedFields((prev) =>
                      prev[f.key] ? prev : { ...prev, [f.key]: true },
                    )
                  }
                  placeholder={f.placeholder}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? `${meta.id}-${f.key}-err` : undefined}
                  className={`h-8 w-full rounded-md border bg-input px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring ${
                    err ? "border-destructive/60" : "border-input"
                  }`}
                  spellCheck={false}
                />
                {err ? (
                  <p
                    id={`${meta.id}-${f.key}-err`}
                    className="text-[10px] text-destructive"
                  >
                    {err}
                  </p>
                ) : f.helper ? (
                  <p className="text-[10px] text-muted-foreground">{f.helper}</p>
                ) : null}
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button
              variant="command"
              size="sm"
              onClick={handleSaveConfig}
              disabled={savingConfig || !draftValid}
              title={!draftValid ? "Fix the highlighted fields before saving." : undefined}
            >
              {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={savingConfig}>
              Cancel
            </Button>
          </div>
        </div>
        );
      })()}

      {/* Inline "Send test email" — only for Gmail. SendGrid has its own
          version on the BYO key card in IntegrationsSettings. */}
      {meta.id === "gmail" && enabled && credentialPresent && !editing && (
        <div className="mb-3">
          <SendTestEmailControl
            provider="gmail"
            providerLabel="Gmail"
            disabledReason={null}
          />
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testLock.locked}
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

// ===== Helpers =====

/**
 * Inline helper shown on connector cards that are enabled in our DB but
 * still missing the gateway-injected credential. Most users don't realise
 * the OAuth handshake has to be triggered by their AI assistant — this
 * panel makes that crystal clear and ships a copy-ready prompt so they
 * don't have to write one themselves.
 */
function AwaitingAuthHelper({
  providerLabel,
  connectorId,
}: {
  providerLabel: string;
  connectorId: string;
}) {
  const [copied, setCopied] = useState(false);
  const prompt = `Please connect the "${connectorId}" connector to this project so I can use ${providerLabel}. Use the standard_connectors connect tool with connector_id "${connectorId}", then confirm when it's linked.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Prompt copied", {
        description: "Paste it into your AI assistant chat to finish setup.",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy", {
        description: "Select the prompt manually and copy it.",
      });
    }
  };

  return (
    <div className="mt-3 mb-3 rounded-md border border-warning/40 bg-warning/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-foreground">
            One last step — finish sign-in with your AI assistant
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            We've enabled {providerLabel} for your workspace. To complete the OAuth handshake,
            ask your AI assistant to link the connector. Copy the prompt below and paste it into chat.
          </p>
        </div>
      </div>
      <div className="rounded bg-background border border-border p-2 text-[11px] font-mono text-foreground/80 break-words leading-snug">
        {prompt}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px] gap-1"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy AI prompt"}
      </Button>
    </div>
  );
}
