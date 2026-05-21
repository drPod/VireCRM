import { useEffect, useState } from "react";
import { validateDraft } from "@/lib/connectors/validation";
import type { Provider, ProviderConfigField, ProviderStatus } from "@/types/integrations";
import {
  seedSettingsDraft,
  type SettingsDraft,
  type TouchedSettings,
} from "@/components/crm/provider-card.types";

export interface UseProviderValidationResult {
  settingsDraft: SettingsDraft;
  setSettingsDraft: React.Dispatch<React.SetStateAction<SettingsDraft>>;
  touchedSettings: TouchedSettings;
  markTouched: (key: string) => void;
  settingsDirty: boolean;
  settingsErrors: Record<string, string | null>;
  settingsValid: boolean;
}

/**
 * Manages the non-secret settings draft (e.g. SendGrid's defaultFromAddress)
 * for a single provider card: reseeds when the saved config arrives, tracks
 * which fields the user has blurred, and runs the shared format validator.
 */
export function useProviderValidation(
  providerId: Provider,
  fields: ProviderConfigField[],
  status: ProviderStatus,
): UseProviderValidationResult {
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() =>
    seedSettingsDraft(fields, status),
  );
  // Tracks which settings inputs have been blurred — controls whether the
  // inline format error renders (we stay quiet until the user moves on).
  const [touchedSettings, setTouchedSettings] = useState<TouchedSettings>({});

  // Reseed the settings draft whenever the saved config changes (e.g. after refresh).
  useEffect(() => {
    setSettingsDraft(seedSettingsDraft(fields, status));
    // A fresh sync from the server is effectively a clean slate — clear
    // the blur history so we don't keep yelling about a field the server
    // just confirmed as valid.
    setTouchedSettings({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.config, providerId]);

  const settingsDirty = fields.some((f) => {
    const saved = status.config?.[f.key];
    const savedStr = saved == null ? "" : String(saved);
    return (settingsDraft[f.key] ?? "") !== savedStr;
  });

  const { errors: settingsErrors, valid: settingsValid } = validateDraft(
    providerId,
    fields,
    settingsDraft,
  );

  const markTouched = (key: string) => {
    setTouchedSettings((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  return {
    settingsDraft,
    setSettingsDraft,
    touchedSettings,
    markTouched,
    settingsDirty,
    settingsErrors,
    settingsValid,
  };
}
