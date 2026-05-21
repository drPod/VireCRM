import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { KeyRound, Loader2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { SendTestEmailControl } from "./SendTestEmailControl";
import { TestResultPanel } from "./TestResultPanel";
import { ProviderCardHeader } from "./ProviderCardHeader";
import { ProviderSetupSteps } from "./ProviderSetupSteps";
import { ProviderCredentialForm } from "./ProviderCredentialForm";
import { ProviderSettingsFields } from "./ProviderSettingsFields";
import { ProviderPrerequisites } from "./ProviderPrerequisites";
import { ProviderConnectedActions } from "./ProviderConnectedActions";
import { ProviderDisconnectDialog } from "./ProviderDisconnectDialog";
import { useProviderValidation } from "@/hooks/useProviderValidation";
import { useProviderTestFlow } from "@/hooks/useProviderTestFlow";
import type { ProviderConfig, ProviderStatus } from "@/types/integrations";

export interface ProviderCardProps {
  config: ProviderConfig;
  status: ProviderStatus;
  loading: boolean;
  onSave: (apiKey: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onTest: () => Promise<{ ok: boolean; reason?: string; verifiedAt?: string } | null>;
  onSaveConfig: (config: Record<string, string | number | boolean | null>) => Promise<void>;
}

export function ProviderCard({
  config,
  status,
  loading,
  onSave,
  onRemove,
  onTest,
  onSaveConfig,
}: ProviderCardProps) {
  const isTwoField = !!config.twoFieldCredentials;
  const [apiKey, setApiKey] = useState("");
  const [fieldOne, setFieldOne] = useState("");
  const [fieldTwo, setFieldTwo] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showStepsForFirstSetup, setShowStepsForFirstSetup] = useState(true);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  // Refs used by the "Run next step" buttons in the prerequisites panel
  // to focus the right input after expanding/scrolling to the editor.
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const fieldOneInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const settingsFields = config.settingsFields ?? [];
  const validation = useProviderValidation(config.id, settingsFields, status);
  const {
    settingsDraft,
    setSettingsDraft,
    markTouched,
    settingsDirty,
    settingsErrors,
    settingsValid,
    touchedSettings,
  } = validation;
  const [savingSettings, setSavingSettings] = useState(false);

  const {
    testResult,
    testing,
    locked: testLocked,
    handleTest,
  } = useProviderTestFlow(status, config.name, onTest);

  const verifiedLabel = status.lastVerifiedAt
    ? `Verified ${formatRelative(status.lastVerifiedAt)}`
    : null;

  // What the user actually submits — single field or joined two fields.
  const submitValue = (): string => {
    if (isTwoField) {
      return `${fieldOne.trim()}${config.twoFieldCredentials!.joiner}${fieldTwo.trim()}`;
    }
    return apiKey.trim();
  };

  const resetInputs = () => {
    setApiKey("");
    setFieldOne("");
    setFieldTwo("");
  };

  const canSubmit = isTwoField
    ? fieldOne.trim().length >= 4 && fieldTwo.trim().length >= 4
    : apiKey.trim().length >= 10;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave(submitValue());
      toast.success(`${config.name} ${editing ? "updated" : "connected"}`, {
        description: editing ? "Your new key is verified and saved." : config.connectedDescription,
      });
      resetInputs();
      setEditing(false);
    } catch (err) {
      toast.error("Couldn't save", {
        description:
          err instanceof Error
            ? `${err.message} — Double-check you copied the whole key.`
            : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await onRemove();
      toast.success(`${config.name} disconnected`);
    } catch (err) {
      toast.error("Couldn't disconnect", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRemoving(false);
      setConfirmDisconnect(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsDirty || !settingsValid) return;
    setSavingSettings(true);
    try {
      // Convert to the shape expected by the server fn — empty strings become null.
      const cfg: Record<string, string | null> = {};
      for (const f of settingsFields) {
        const v = (settingsDraft[f.key] ?? "").trim();
        cfg[f.key] = v.length ? v : null;
      }
      await onSaveConfig(cfg);
      toast.success(`${config.name} settings saved`);
    } catch (err) {
      toast.error("Couldn't save settings", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const focusKeyInput = () => {
    // Reveal setup steps + scroll into view, then focus the first input.
    setShowStepsForFirstSetup(true);
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      const target = isTwoField ? fieldOneInputRef.current : apiKeyInputRef.current;
      target?.focus();
    });
  };

  const beginEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      const target = isTwoField ? fieldOneInputRef.current : apiKeyInputRef.current;
      target?.focus();
    });
  };

  const credentialForm = (
    <ProviderCredentialForm
      config={config}
      editing={editing}
      saving={saving}
      apiKey={apiKey}
      fieldOne={fieldOne}
      fieldTwo={fieldTwo}
      onApiKeyChange={setApiKey}
      onFieldOneChange={setFieldOne}
      onFieldTwoChange={setFieldTwo}
      onSave={handleSave}
      onCancel={() => {
        setEditing(false);
        resetInputs();
      }}
      apiKeyInputRef={apiKeyInputRef}
      fieldOneInputRef={fieldOneInputRef}
    />
  );

  return (
    <Card ref={cardRef} className="p-6">
      <ProviderCardHeader config={config} status={status} />

      {!loading && (
        <ProviderPrerequisites
          config={config}
          status={status}
          testResult={testResult}
          settingsDraft={settingsDraft}
          onAction={async (actionId) => {
            switch (actionId) {
              case "focus-key-input":
                focusKeyInput();
                break;
              case "edit-key":
                beginEdit();
                break;
              case "test":
                await handleTest();
                break;
              case "open-docs":
                window.open(config.docsUrl, "_blank", "noopener,noreferrer");
                break;
            }
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : status.configured ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <code className="font-mono text-foreground">{status.maskedKey}</code>
            </div>
            {verifiedLabel && (
              <span className="text-xs text-muted-foreground">{verifiedLabel}</span>
            )}
          </div>

          {editing ? (
            <>
              <ProviderSetupSteps providerName={config.name} steps={config.setupSteps} />
              {credentialForm}
            </>
          ) : (
            <div className="space-y-3">
              <ProviderConnectedActions
                testing={testing}
                testLocked={testLocked}
                removing={removing}
                onTest={handleTest}
                onEdit={() => setEditing(true)}
                onDisconnect={() => setConfirmDisconnect(true)}
              />
              <TestResultPanel result={testResult} testing={testing} providerLabel={config.name} />
              {settingsFields.length > 0 && (
                <ProviderSettingsFields
                  providerId={config.id}
                  fields={settingsFields}
                  draft={settingsDraft}
                  errors={settingsErrors}
                  touched={touchedSettings}
                  dirty={settingsDirty}
                  valid={settingsValid}
                  saving={savingSettings}
                  onChange={(key, value) => setSettingsDraft((prev) => ({ ...prev, [key]: value }))}
                  onBlur={markTouched}
                  onSave={handleSaveSettings}
                />
              )}
              {config.id === "sendgrid" && (
                <SendTestEmailControl
                  provider="sendgrid"
                  providerLabel="SendGrid"
                  disabledReason={
                    typeof status.config?.defaultFromAddress === "string" &&
                    status.config.defaultFromAddress.trim().length > 0
                      ? null
                      : "Set a Send-from address above and save before sending a test."
                  }
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {showStepsForFirstSetup ? (
            <ProviderSetupSteps providerName={config.name} steps={config.setupSteps} />
          ) : (
            <button
              type="button"
              onClick={() => setShowStepsForFirstSetup(true)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <HelpCircle className="h-3 w-3" />
              Show step-by-step setup guide
            </button>
          )}
          {credentialForm}
        </div>
      )}

      <ProviderDisconnectDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        providerName={config.name}
        removeConfirm={config.removeConfirm}
        removing={removing}
        onConfirm={handleRemove}
      />
    </Card>
  );
}

// Tiny relative-time formatter — keeps the card label compact ("5m ago", "yesterday").
// TODO: dedup with src/lib/date-utils.ts formatRelativeTime when Unit 7 lands
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
