/**
 * Industry template — single-vertical state.
 *
 * Energy is the only paying vertical, so the type surface is narrowed to just
 * the energy preset (terminology, default modules, theme, pipeline stages).
 * The machinery (IndustryGate, INDUSTRY_TEMPLATES record, `industry_template`
 * DB column) is intentionally preserved so a future vertical can be added by
 * widening `IndustryKey` and appending an entry to `INDUSTRY_TEMPLATES`.
 *
 * Legacy verticals removed: `general`, `gym`, `solar`, `real_estate`,
 * `insurance` (Lovable scaffold that padlocked the energy UI).
 */

export type IndustryKey = "energy";

export interface IndustryTemplate {
  key: IndustryKey;
  name: string;
  tagline: string;
  description: string;
  /** Hex colors fed into the existing white-label engine. */
  theme: {
    primary: string;
    accent: string;
    sidebar: string;
  };
  /** Module keys auto-enabled when this template is picked. */
  defaultModules: string[];
  /** Sales pipeline stages tailored to this industry. */
  pipelineStages: string[];
  /** Single-source-of-truth for industry-specific UI labels. */
  terminology: {
    lead: string;
    leadPlural: string;
    customer: string;
    deal: string;
    pipeline: string;
  };
}

export const INDUSTRY_TEMPLATES: Record<IndustryKey, IndustryTemplate> = {
  energy: {
    key: "energy",
    name: "Energy Consulting",
    tagline: "From LOA to renewal — every commercial energy deal in one place",
    description:
      "Built for commercial energy brokers: LOA workflow, usage requests, supplier pricing, contract submissions, commission tracking, and renewals.",
    theme: { primary: "#10b981", accent: "#34d399", sidebar: "#052e1f" },
    defaultModules: [
      "leads",
      "energy_loa",
      "energy_usage",
      "energy_pricing",
      "energy_contracts",
      "energy_suppliers",
      "energy_renewals",
      "commissions",
      "analytics",
    ],
    pipelineStages: [
      "New Lead",
      "Contacted",
      "Qualified",
      "LOA Requested",
      "LOA Received",
      "Usage Requested",
      "Pricing Requested",
      "Proposal Sent",
      "Contract Requested",
      "Signed",
      "Enrolled",
      "Renewal",
      "Lost",
    ],
    terminology: {
      lead: "Prospect",
      leadPlural: "Prospects",
      customer: "Account",
      deal: "Contract",
      pipeline: "Energy Pipeline",
    },
  },
};

export const INDUSTRY_LIST: IndustryTemplate[] = Object.values(INDUSTRY_TEMPLATES);

export function getTemplate(key: string | null | undefined): IndustryTemplate {
  if (!key) return INDUSTRY_TEMPLATES.energy;
  return INDUSTRY_TEMPLATES[key as IndustryKey] ?? INDUSTRY_TEMPLATES.energy;
}
