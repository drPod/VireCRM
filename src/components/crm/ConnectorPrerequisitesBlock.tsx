import { toast } from "sonner";
import type { ConnectorStatus } from "@/functions/connectors.functions";
import type { ConnectorMeta } from "@/lib/connectors/catalog";
import { deriveConnectorPrerequisites } from "@/lib/connectors/prerequisites";
import { PrerequisitesPanel } from "./PrerequisitesPanel";
import type { TestResult } from "./TestResultPanel";

interface ConnectorPrerequisitesBlockProps {
  meta: ConnectorMeta;
  status: ConnectorStatus | undefined;
  draftWhileEditing: Record<string, string> | null;
  testResult: TestResult | null;
  hasConfigFields: boolean;
  onEnable: () => Promise<void>;
  onTest: () => Promise<void>;
  onEditConfig: () => void;
}

export function ConnectorPrerequisitesBlock({
  meta,
  status,
  draftWhileEditing,
  testResult,
  hasConfigFields,
  onEnable,
  onTest,
  onEditConfig,
}: ConnectorPrerequisitesBlockProps) {
  // While editing, feed the in-progress draft so the prerequisites
  // panel updates live (e.g. "Send-from address is required" disappears
  // the moment the user types a valid email — no save needed).
  const prereqs = deriveConnectorPrerequisites(meta, status, draftWhileEditing);
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
          lastVerifiedAt: testResult?.verifiedAt ?? status?.enabledAt ?? null,
          outcome: testResult
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
              await onEnable();
              break;
            case "reconnect":
              // Re-trigger the enable flow — for OAuth connectors this
              // re-runs the gateway's connect handshake.
              await onEnable();
              toast.info(`Finish ${meta.name} sign-in`, {
                description:
                  "If a provider window didn't open, your workspace owner needs to approve the connection.",
              });
              break;
            case "test":
              await onTest();
              break;
            case "edit-config":
              if (hasConfigFields) onEditConfig();
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
}
