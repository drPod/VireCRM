/**
 * Pure helpers that derive a list of missing prerequisites for an
 * integration card from its current status. Kept UI-free so it can be
 * reused by both connector cards and BYO API key cards.
 */
import type { ConnectorMeta } from "./catalog";
import { FIELD_RULES, validateDraft } from "./validation";
import type { Prerequisite } from "@/components/crm/PrerequisitesPanel";

interface ConnectorStatusLike {
  enabled: boolean;
  credentialPresent: boolean;
  verified: boolean | null;
  verifyError: string | null;
  config: Record<string, string | number | boolean | null> | null | undefined;
}

/**
 * Prerequisites for a one-click connector (Slack / Gmail / HubSpot / …).
 * Order: enable → OAuth link → verify → required config → recommended config.
 *
 * Every item carries an `actionId` so the card can wire a "Run next step"
 * button to the appropriate local handler (Connect / Test / Edit / …).
 */
export function deriveConnectorPrerequisites(
  meta: ConnectorMeta,
  status: ConnectorStatusLike | undefined,
  /**
   * Optional in-progress edits. When provided, each key overrides the
   * corresponding saved value from `status.config` so the prerequisites
   * panel reflects what the user is typing right now (not what's saved).
   * Empty strings are treated as "user cleared this field".
   */
  configOverride?: Record<string, string> | null,
): Prerequisite[] {
  const out: Prerequisite[] = [];

  if (!status || !status.enabled) {
    out.push({
      id: "not-enabled",
      title: "Not connected yet",
      nextStep: `Click "Connect" to start the ${meta.name} sign-in flow.`,
      severity: "blocking",
      actionId: "connect",
      actionLabel: `Connect ${meta.name}`,
    });
    return out;
  }

  if (!status.credentialPresent) {
    out.push({
      id: "awaiting-auth",
      title: "Awaiting workspace authorization",
      nextStep: `Your workspace owner needs to finish the ${meta.name} OAuth flow so we receive an access token.`,
      severity: "blocking",
      link: { label: "Provider docs", href: meta.docsUrl, external: true },
      actionId: "reconnect",
      actionLabel: "Restart sign-in",
    });
    return out;
  }

  if (status.verified === false) {
    out.push({
      id: "verify-failed",
      title: "Last verification failed",
      nextStep: status.verifyError?.trim()
        ? `Provider said: "${status.verifyError.trim()}". Click Test to retry, or disconnect and reconnect.`
        : "Click Test to retry. If it keeps failing, disconnect and reconnect.",
      severity: "blocking",
      actionId: "test",
      actionLabel: "Run test now",
    });
  }

  // Required + recommended config fields.
  const fields = meta.configFields ?? [];
  if (fields.length > 0) {
    const draft: Record<string, string> = {};
    for (const f of fields) {
      // Prefer the in-progress override (even an empty string means "cleared").
      if (configOverride && Object.prototype.hasOwnProperty.call(configOverride, f.key)) {
        draft[f.key] = configOverride[f.key] ?? "";
        continue;
      }
      const v = status.config?.[f.key];
      draft[f.key] = v == null ? "" : String(v);
    }
    const { errors } = validateDraft(meta.id, fields, draft);
    for (const f of fields) {
      const ruleKey = `${meta.id}.${f.key}`;
      const rule = FIELD_RULES[ruleKey];
      const value = (draft[f.key] ?? "").trim();
      const err = errors[f.key];
      if (rule?.required && value.length === 0) {
        out.push({
          id: `cfg-missing-${f.key}`,
          title: `${f.label} is required`,
          nextStep:
            f.helper ?? `Open the Edit panel and fill in "${f.label}" so this integration can run.`,
          severity: "blocking",
          actionId: "edit-config",
          actionLabel: `Edit ${meta.name} settings`,
        });
      } else if (err) {
        out.push({
          id: `cfg-invalid-${f.key}`,
          title: `${f.label} is invalid`,
          nextStep: `${err} Update it from the Edit panel.`,
          severity: "blocking",
          actionId: "edit-config",
          actionLabel: `Edit ${meta.name} settings`,
        });
      } else if (!rule?.required && value.length === 0) {
        out.push({
          id: `cfg-empty-${f.key}`,
          title: `${f.label} not set`,
          nextStep: f.helper ?? `Optional — set it from Edit to customize ${meta.name} behavior.`,
          severity: "recommended",
          actionId: "edit-config",
          actionLabel: `Edit ${meta.name} settings`,
        });
      }
    }
  }

  return out;
}

/**
 * Prerequisites for a BYO API key provider (Apollo / Hunter / Snov / SendGrid).
 */
interface ByoProviderStatusLike {
  configured: boolean;
  lastVerifiedAt?: string | null;
  config?: Record<string, string | number | boolean | null>;
}

interface ByoFieldDescriptor {
  key: string;
  label: string;
  helper?: string;
}

export function deriveByoPrerequisites(args: {
  providerId: string;
  providerName: string;
  docsUrl: string;
  status: ByoProviderStatusLike;
  settingsFields: ByoFieldDescriptor[];
  /**
   * Test result from the latest in-memory Test run, if any. Lets us flag
   * a failed verification even before the saved status is updated.
   */
  lastTest?: { ok: boolean; reason?: string } | null;
  /**
   * Optional in-progress edits for the settings draft. When provided, each
   * key overrides the saved value so the prereqs panel updates live as the
   * user types. Empty strings count as "user cleared this field".
   */
  configOverride?: Record<string, string> | null;
}): Prerequisite[] {
  const { providerId, providerName, docsUrl, status, settingsFields, lastTest, configOverride } =
    args;
  const out: Prerequisite[] = [];

  if (!status.configured) {
    out.push({
      id: "byo-key-missing",
      title: "BYO API key not set",
      nextStep: `Paste your ${providerName} API key below to enable this integration.`,
      severity: "blocking",
      link: { label: `Get ${providerName} key`, href: docsUrl, external: true },
      actionId: "focus-key-input",
      actionLabel: "Paste API key",
    });
    return out;
  }

  if (lastTest && lastTest.ok === false) {
    out.push({
      id: "byo-test-failed",
      title: "Last test run failed",
      nextStep: lastTest.reason
        ? `Provider said: "${lastTest.reason}". Use Edit to replace the key, or click Test to retry.`
        : "Use Edit to replace the key, or click Test to retry.",
      severity: "blocking",
      actionId: "test",
      actionLabel: "Run test now",
    });
  }

  if (settingsFields.length > 0) {
    const draft: Record<string, string> = {};
    for (const f of settingsFields) {
      if (configOverride && Object.prototype.hasOwnProperty.call(configOverride, f.key)) {
        draft[f.key] = configOverride[f.key] ?? "";
        continue;
      }
      const v = status.config?.[f.key];
      draft[f.key] = v == null ? "" : String(v);
    }
    const { errors } = validateDraft(providerId, settingsFields, draft);
    for (const f of settingsFields) {
      const ruleKey = `${providerId}.${f.key}`;
      const rule = FIELD_RULES[ruleKey];
      const value = (draft[f.key] ?? "").trim();
      const err = errors[f.key];
      if (rule?.required && value.length === 0) {
        out.push({
          id: `byo-cfg-missing-${f.key}`,
          title: `${f.label} is required`,
          nextStep: f.helper ?? `Set "${f.label}" below before this provider can send anything.`,
          severity: "blocking",
          actionId: "edit-key",
          actionLabel: `Edit ${providerName} settings`,
        });
      } else if (err) {
        out.push({
          id: `byo-cfg-invalid-${f.key}`,
          title: `${f.label} is invalid`,
          nextStep: `${err} Update it in the settings panel below.`,
          severity: "blocking",
          actionId: "edit-key",
          actionLabel: `Edit ${providerName} settings`,
        });
      } else if (!rule?.required && value.length === 0) {
        out.push({
          id: `byo-cfg-empty-${f.key}`,
          title: `${f.label} not set`,
          nextStep:
            f.helper ?? `Optional — set "${f.label}" to customize how ${providerName} runs.`,
          severity: "recommended",
          actionId: "edit-key",
          actionLabel: `Edit ${providerName} settings`,
        });
      }
    }
  }

  return out;
}
