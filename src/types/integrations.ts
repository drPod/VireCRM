/**
 * Shared types for BYO lead-source / email-provider integrations
 * (Apollo, Hunter, Snov, SendGrid) rendered by `IntegrationsSettings`
 * + `ProviderCard`. Static provider config lives in
 * `src/lib/provider-configs.ts`.
 */

export type Provider = "apollo" | "hunter" | "snov" | "sendgrid";

export interface ProviderConfigField {
  key: string;
  label: string;
  placeholder?: string;
  helper?: string;
}

export interface ProviderConfig {
  id: Provider;
  name: string;
  /** Short pitch shown under the name. */
  description: string;
  /** Where to grab a key. */
  docsUrl: string;
  /** Helper shown above the input. */
  inputHint: string;
  /** Toast description after a successful connect. */
  connectedDescription: string;
  /** Confirmation prompt before removal. */
  removeConfirm: string;
  /** Plain-English step-by-step setup guide. Shown as a numbered list. */
  setupSteps: string[];
  /** Two-field credentials? (e.g. Snov needs client_id + secret). */
  twoFieldCredentials?: {
    fieldOneLabel: string;
    fieldOnePlaceholder: string;
    fieldTwoLabel: string;
    fieldTwoPlaceholder: string;
    /** How the two are joined when sent to the server. */
    joiner: string;
  };
  /** Non-secret editable settings (stored in org_integrations.config). */
  settingsFields?: ProviderConfigField[];
}

export interface ProviderStatus {
  configured: boolean;
  maskedKey?: string;
  lastVerifiedAt?: string | null;
  /** Non-secret config (e.g. SendGrid default from address). */
  config?: Record<string, string | number | boolean | null>;
}
