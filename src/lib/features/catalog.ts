/**
 * Catalog of "custom features" you can sell to enterprise / white-label clients
 * without changing the base CRM. Toggle these per-organization from the
 * Platform Admin panel — code reads them via `useFeatureFlag(key)`.
 *
 * To add a new sellable feature:
 *   1. Add an entry here with a stable `key` (snake_case, never rename).
 *   2. Wrap the UI/route in `<FeatureGate feature="...">` or check
 *      `useFeatureFlag("...")` in code.
 *   3. Toggle it for the buying org from Settings → Platform Admin → Features.
 */
export interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  category: "ai" | "automation" | "integrations" | "branding" | "limits" | "custom";
  /** Optional default config shape — purely documentation for now. */
  defaultConfig?: Record<string, unknown>;
}

export const FEATURE_CATALOG: FeatureDefinition[] = [
  {
    key: "advanced_ai_advisor",
    name: "Advanced AI Advisor",
    description: "Unlocks higher-tier model + larger context for the AI Advisor panel.",
    category: "ai",
  },
  {
    key: "white_label_emails",
    name: "White-label transactional emails",
    description: "Send all transactional emails from the client's verified domain.",
    category: "branding",
  },
  {
    key: "custom_workflow_nodes",
    name: "Custom workflow nodes",
    description: "Unlocks premium workflow node types (webhooks, conditional branching, delays).",
    category: "automation",
  },
  {
    key: "priority_lead_enrichment",
    name: "Priority lead enrichment",
    description: "Enriches leads via the highest-quality data provider tier.",
    category: "integrations",
  },
  {
    key: "unlimited_leads",
    name: "Unlimited monthly leads",
    description: "Removes the monthly lead quota entirely for this org.",
    category: "limits",
  },
  {
    key: "api_access",
    name: "Public API access",
    description: "Issues an API key the client can use to read/write CRM data programmatically.",
    category: "integrations",
  },
  {
    key: "dedicated_support",
    name: "Dedicated support channel",
    description: "Surfaces a priority support contact in-app.",
    category: "custom",
  },
  {
    key: "custom_reports",
    name: "Custom reports",
    description: "Unlocks the custom report builder + exports beyond the standard analytics.",
    category: "custom",
  },
];

export const FEATURE_BY_KEY: Record<string, FeatureDefinition> = Object.fromEntries(
  FEATURE_CATALOG.map((f) => [f.key, f]),
);

export type FeatureKey = (typeof FEATURE_CATALOG)[number]["key"];
