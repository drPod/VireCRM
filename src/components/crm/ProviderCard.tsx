import { useEffect, useRef, useState } from "react";
import { useActionLock } from "@/hooks/useActionLock";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  ExternalLink,
  Trash2,
  Pencil,
  Activity,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { SendTestEmailControl } from "./SendTestEmailControl";
import { TestResultPanel, type TestResult } from "./TestResultPanel";
import { validateDraft, FIELD_RULES } from "@/lib/connectors/validation";
import { deriveByoPrerequisites } from "@/lib/connectors/prerequisites";
import { PrerequisitesPanel } from "./PrerequisitesPanel";
import { VerifiedExplainer } from "./VerifiedExplainer";
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
  // Test button uses a single-flight lock — see useActionLock for rationale.
  const testLock = useActionLock();
  const testing = testLock.loading;
  const [editing, setEditing] = useState(false);
  const [showStepsForFirstSetup, setShowStepsForFirstSetup] = useState(true);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  // Refs used by the "Run next step" buttons in the prerequisites panel
  // to focus the right input after expanding/scrolling to the editor.
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const fieldOneInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // Latest Test result, kept inline on the card until the next Test run replaces it.
  const [testResult, setTestResult] = useState<TestResult | null>(() =>
    status.lastVerifiedAt ? { ok: true, verifiedAt: status.lastVerifiedAt } : null,
  );

  // If the saved `lastVerifiedAt` changes (e.g. after refresh from another
  // tab) and we don't already have a fresher local result, hydrate from it
  // so the card shows the most recent known state on mount.
  useEffect(() => {
    if (!status.lastVerifiedAt) return;
    setTestResult((prev) => {
      if (
        prev &&
        new Date(prev.verifiedAt).getTime() >= new Date(status.lastVerifiedAt!).getTime()
      ) {
        return prev;
      }
      return { ok: true, verifiedAt: status.lastVerifiedAt! };
    });
  }, [status.lastVerifiedAt]);

  // Non-secret settings draft (e.g. SendGrid's defaultFromAddress).
  const settingsFields = config.settingsFields ?? [];
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const f of settingsFields) {
      const v = status.config?.[f.key];
      seed[f.key] = v == null ? "" : String(v);
    }
    return seed;
  });
  const [savingSettings, setSavingSettings] = useState(false);
  // Tracks which settings inputs have been blurred — controls whether the
  // inline format error renders (we stay quiet until the user moves on).
  const [touchedSettings, setTouchedSettings] = useState<Record<string, boolean>>({});

  // Reseed the settings draft whenever the saved config changes (e.g. after refresh).
  useEffect(() => {
    const seed: Record<string, string> = {};
    for (const f of settingsFields) {
      const v = status.config?.[f.key];
      seed[f.key] = v == null ? "" : String(v);
    }
    setSettingsDraft(seed);
    // A fresh sync from the server is effectively a clean slate — clear
    // the blur history so we don't keep yelling about a field the server
    // just confirmed as valid.
    setTouchedSettings({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.config, config.id]);

  const settingsDirty = settingsFields.some((f) => {
    const saved = status.config?.[f.key];
    const savedStr = saved == null ? "" : String(saved);
    return (settingsDraft[f.key] ?? "") !== savedStr;
  });

  const { errors: settingsErrors, valid: settingsValid } = validateDraft(
    config.id,
    settingsFields,
    settingsDraft,
  );

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

  const canSubmit = isTwoField
    ? fieldOne.trim().length >= 4 && fieldTwo.trim().length >= 4
    : apiKey.trim().length >= 10;

  const resetInputs = () => {
    setApiKey("");
    setFieldOne("");
    setFieldTwo("");
  };

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

  const handleTest = async () => {
    await testLock.run(async () => {
      const ranAt = new Date().toISOString();
      try {
        const res = await onTest();
        if (res?.ok) {
          setTestResult({ ok: true, verifiedAt: res.verifiedAt ?? ranAt });
          toast.success(`${config.name} is working`, {
            description: "Credentials verified successfully.",
          });
        } else {
          const reason = res?.reason ?? "No response from provider.";
          setTestResult({ ok: false, reason, verifiedAt: ranAt });
          toast.error(`${config.name} test failed`, { description: reason });
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Unknown error";
        setTestResult({ ok: false, reason, verifiedAt: ranAt });
        toast.error("Test failed", { description: reason });
      }
    });
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

  // Step-by-step "How to get your key" panel — the headline accessibility win
  // for non-technical users. Always visible on first setup; hidden by default
  // when editing an existing connection.
  const renderSetupSteps = () => (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            How to set up {config.name} (takes 2 minutes)
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Follow these steps in order. The link opens {config.name} in a new browser tab.
          </p>
        </div>
      </div>
      <ol className="space-y-2 ml-1">
        {config.setupSteps.map((step, i) => (
          <li key={i} className="flex gap-3 text-xs text-foreground">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <span className="pt-0.5 leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );

  // The credential editor — single text field OR two side-by-side fields.
  const renderEditor = () => {
    const tf = config.twoFieldCredentials;
    return (
      <div className="space-y-3">
        {isTwoField && tf ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                {tf.fieldOneLabel}
              </label>
              <input
                ref={fieldOneInputRef}
                type="text"
                value={fieldOne}
                onChange={(e) => setFieldOne(e.target.value)}
                placeholder={tf.fieldOnePlaceholder}
                className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
                autoComplete="off"
                spellCheck={false}
                maxLength={250}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                {tf.fieldTwoLabel}
              </label>
              <input
                type="password"
                value={fieldTwo}
                onChange={(e) => setFieldTwo(e.target.value)}
                placeholder={tf.fieldTwoPlaceholder}
                className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
                autoComplete="off"
                spellCheck={false}
                maxLength={250}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">
              {config.name} API key
            </label>
            <input
              ref={apiKeyInputRef}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config.inputHint}
              className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
              autoComplete="off"
              spellCheck={false}
              maxLength={500}
            />
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button variant="command" size="sm" onClick={handleSave} disabled={saving || !canSubmit}>
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Checking with {config.name}…
              </>
            ) : editing ? (
              "Save new key"
            ) : (
              `Connect ${config.name}`
            )}
          </Button>
          {editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                resetInputs();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <KeyRound className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Your credentials are stored encrypted and only used by our servers. Your team and
            browser never see them.
          </span>
        </p>
      </div>
    );
  };

  return (
    <Card ref={cardRef} className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">{config.name}</h3>
            {status.configured ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-success" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
            {/* Inline help — explains what "Verified" / "Connected" means
                for a BYO key card (we called the provider directly with
                the saved key and got a 200-class response). */}
            <VerifiedExplainer variant="byo" providerLabel={config.name} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        <a
          href={config.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          Get API key <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {!loading &&
        (() => {
          const prereqs = deriveByoPrerequisites({
            providerId: config.id,
            providerName: config.name,
            docsUrl: config.docsUrl,
            status,
            settingsFields: settingsFields.map((f) => ({
              key: f.key,
              label: f.label,
              helper: f.helper,
            })),
            lastTest: testResult
              ? { ok: testResult.ok, reason: testResult.reason ?? undefined }
              : null,
            // Live overlay so the panel reflects what the user is typing in
            // the settings panel below (no save needed to clear "missing"
            // or "invalid" entries).
            configOverride: settingsFields.length > 0 ? settingsDraft : null,
          });
          if (prereqs.length === 0) return null;
          const focusKeyInput = () => {
            // Reveal setup steps + scroll into view, then focus the first input.
            setShowStepsForFirstSetup(true);
            requestAnimationFrame(() => {
              cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              const target = isTwoField ? fieldOneInputRef.current : apiKeyInputRef.current;
              target?.focus();
            });
          };
          return (
            <div className="mb-4">
              <PrerequisitesPanel
                prerequisites={prereqs}
                providerLabel={config.name}
                verification={{
                  // Freshest test result beats the saved lastVerifiedAt.
                  lastVerifiedAt: testResult?.verifiedAt ?? status.lastVerifiedAt ?? null,
                  outcome: testResult
                    ? testResult.ok
                      ? "ok"
                      : "failed"
                    : status.lastVerifiedAt
                      ? "ok"
                      : "unknown",
                  failureReason: testResult && !testResult.ok ? (testResult.reason ?? null) : null,
                }}
                onAction={async (p) => {
                  switch (p.actionId) {
                    case "focus-key-input":
                      focusKeyInput();
                      break;
                    case "edit-key":
                      setEditing(true);
                      requestAnimationFrame(() => {
                        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        const target = isTwoField
                          ? fieldOneInputRef.current
                          : apiKeyInputRef.current;
                        target?.focus();
                      });
                      break;
                    case "test":
                      await handleTest();
                      break;
                    case "open-docs":
                      window.open(config.docsUrl, "_blank", "noopener,noreferrer");
                      break;
                    default:
                      break;
                  }
                }}
              />
            </div>
          );
        })()}

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
              {renderSetupSteps()}
              {renderEditor()}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
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
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDisconnect(true)}
                  disabled={removing}
                >
                  {removing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Disconnect
                </Button>
              </div>
              <TestResultPanel result={testResult} testing={testing} providerLabel={config.name} />
              {settingsFields.length > 0 && (
                <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3">
                  {settingsFields.map((f) => {
                    const ruleKey = `${config.id}.${f.key}`;
                    const rule = FIELD_RULES[ruleKey];
                    const rawErr = settingsErrors[f.key];
                    // Hide the inline error until the user blurs the field
                    // — once touched, it re-validates live as they type.
                    const err = touchedSettings[f.key] ? rawErr : null;
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
                          value={settingsDraft[f.key] ?? ""}
                          onChange={(e) =>
                            setSettingsDraft((prev) => ({ ...prev, [f.key]: e.target.value }))
                          }
                          onBlur={() =>
                            setTouchedSettings((prev) =>
                              prev[f.key] ? prev : { ...prev, [f.key]: true },
                            )
                          }
                          placeholder={f.placeholder}
                          aria-invalid={err ? true : undefined}
                          aria-describedby={err ? `${config.id}-${f.key}-err` : undefined}
                          className={`h-8 w-full rounded-md border bg-input px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring ${
                            err ? "border-destructive/60" : "border-input"
                          }`}
                          spellCheck={false}
                          disabled={savingSettings}
                        />
                        {err ? (
                          <p
                            id={`${config.id}-${f.key}-err`}
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
                  {settingsDirty && (
                    <Button
                      variant="command"
                      size="sm"
                      onClick={handleSaveSettings}
                      disabled={savingSettings || !settingsValid}
                      title={
                        !settingsValid ? "Fix the highlighted fields before saving." : undefined
                      }
                    >
                      {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Save settings
                    </Button>
                  )}
                </div>
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
            renderSetupSteps()
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
          {renderEditor()}
        </div>
      )}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {config.name}?</AlertDialogTitle>
            <AlertDialogDescription>{config.removeConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Keep connected</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing}>
              {removing ? (
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
