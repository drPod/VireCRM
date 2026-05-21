import type { ProviderConfigField, ProviderStatus } from "@/types/integrations";

/** Map of settings field key → current draft string value. */
export type SettingsDraft = Record<string, string>;

/** Map of settings field key → whether the user has blurred it once. */
export type TouchedSettings = Record<string, boolean>;

/** Seed a fresh draft from the saved provider config. */
export function seedSettingsDraft(
  fields: ProviderConfigField[],
  status: ProviderStatus,
): SettingsDraft {
  const seed: SettingsDraft = {};
  for (const f of fields) {
    const v = status.config?.[f.key];
    seed[f.key] = v == null ? "" : String(v);
  }
  return seed;
}
