import { PrerequisitesPanel } from "./PrerequisitesPanel";
import { deriveByoPrerequisites } from "@/lib/connectors/prerequisites";
import type { TestResult } from "./TestResultPanel";
import type { ProviderConfig, ProviderStatus } from "@/types/integrations";
import type { SettingsDraft } from "./provider-card.types";

export type PrerequisiteActionId = "focus-key-input" | "edit-key" | "test" | "open-docs";

export interface ProviderPrerequisitesProps {
  config: ProviderConfig;
  status: ProviderStatus;
  testResult: TestResult | null;
  settingsDraft: SettingsDraft;
  onAction: (actionId: PrerequisiteActionId) => void | Promise<void>;
}

/**
 * The "what's missing / what's next" panel above the credential editor.
 * Derives the prerequisite list from saved status + the live settings draft
 * so the panel updates as the user types (no save needed to clear entries).
 */
export function ProviderPrerequisites({
  config,
  status,
  testResult,
  settingsDraft,
  onAction,
}: ProviderPrerequisitesProps) {
  const settingsFields = config.settingsFields ?? [];
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
    lastTest: testResult ? { ok: testResult.ok, reason: testResult.reason ?? undefined } : null,
    // Live overlay so the panel reflects what the user is typing in
    // the settings panel below (no save needed to clear "missing"
    // or "invalid" entries).
    configOverride: settingsFields.length > 0 ? settingsDraft : null,
  });
  if (prereqs.length === 0) return null;

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
          await onAction(p.actionId as PrerequisiteActionId);
        }}
      />
    </div>
  );
}
