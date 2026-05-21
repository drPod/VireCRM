import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActionLock } from "@/hooks/useActionLock";
import type { ConnectorStatus } from "@/functions/connectors.functions";
import type { ConnectorMeta } from "@/lib/connectors/catalog";
import { VerifiedExplainer } from "./VerifiedExplainer";
import { SendTestEmailControl } from "./SendTestEmailControl";
import { TestResultPanel, type TestResult } from "./TestResultPanel";
import { AwaitingAuthHelper } from "./AwaitingAuthHelper";
import { ConnectorStatusBadge } from "./ConnectorStatusBadge";
import { ConnectorConfigEditor } from "./ConnectorConfigEditor";
import { seedDraftFromStatus } from "@/lib/connectors/config-draft";
import { ConnectorPrerequisitesBlock } from "./ConnectorPrerequisitesBlock";
import { ConnectorDisconnectDialog } from "./ConnectorDisconnectDialog";
import { ConnectorCardActions } from "./ConnectorCardActions";

export interface ConnectorCardProps {
  meta: ConnectorMeta;
  status: ConnectorStatus | undefined;
  loading: boolean;
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
  onTest: () => Promise<TestResult>;
  onSaveConfig: (config: Record<string, string>) => Promise<void>;
  organizationId: string | null;
}

export function ConnectorCard({
  meta,
  status,
  loading,
  onEnable,
  onDisable,
  onTest,
  onSaveConfig,
  organizationId,
}: ConnectorCardProps) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftConfig, setDraftConfig] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const enabled = !!status?.enabled;
  const credentialPresent = !!status?.credentialPresent;
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
    setDraftConfig(seedDraftFromStatus(meta, status?.config));
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
            <ConnectorStatusBadge status={status} loading={loading} />
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

      {!loading && enabled && !credentialPresent && (
        <AwaitingAuthHelper providerLabel={meta.name} connectorId={meta.connectorId} />
      )}

      {!loading && (
        <ConnectorPrerequisitesBlock
          meta={meta}
          status={status}
          draftWhileEditing={editing ? draftConfig : null}
          testResult={testResult}
          hasConfigFields={hasConfigFields}
          onEnable={handleEnable}
          onTest={handleTest}
          onEditConfig={openEditor}
        />
      )}

      {(testResult || testing) && (
        <div className="mb-3">
          <TestResultPanel result={testResult} testing={testing} providerLabel={meta.name} />
        </div>
      )}

      {enabled && editing && hasConfigFields && (
        <ConnectorConfigEditor
          meta={meta}
          draft={draftConfig}
          onDraftChange={setDraftConfig}
          saving={savingConfig}
          onSave={handleSaveConfig}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Inline "Send test email" — only for Gmail. SendGrid has its own
          version on the BYO key card in IntegrationsSettings. */}
      {meta.id === "gmail" && enabled && credentialPresent && !editing && (
        <div className="mb-3">
          <SendTestEmailControl provider="gmail" providerLabel="Gmail" disabledReason={null} />
        </div>
      )}

      <ConnectorCardActions
        meta={meta}
        status={status}
        loading={loading}
        enabled={enabled}
        busy={busy}
        testing={testing}
        testLocked={testLock.locked}
        editing={editing}
        hasConfigFields={hasConfigFields}
        organizationId={organizationId}
        onEnable={handleEnable}
        onTest={handleTest}
        onEdit={openEditor}
        onAskDisconnect={() => setConfirmDisconnect(true)}
      />

      <ConnectorDisconnectDialog
        providerName={meta.name}
        open={confirmDisconnect}
        busy={busy}
        onOpenChange={setConfirmDisconnect}
        onConfirm={handleDisable}
      />
    </Card>
  );
}
