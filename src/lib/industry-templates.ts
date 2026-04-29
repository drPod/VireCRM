/**
 * Industry templates — pre-configured CRM presets that re-skin terminology,
 * default modules, theme colors, and pipeline stages so each industry feels
 * native instead of generic. The owner picks one in the onboarding wizard.
 *
 * Adding a new industry: append an entry here, and the wizard + sidebar pick
 * it up automatically. UI never references colors directly — values flow into
 * the white-label theme variables (--primary, --accent, --sidebar) via the
 * existing applyWhiteLabelColor() helper.
 */

export type IndustryKey =
  | "general"
  | "energy"
  | "gym"
  | "solar"
  | "real_estate"
  | "insurance";

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
  general: {
    key: "general",
    name: "General CRM",
    tagline: "Flexible setup for any business",
    description:
      "Standard pipeline, leads, and tasks. Pick this if your industry isn't listed — you can always switch later.",
    theme: { primary: "#3b82f6", accent: "#60a5fa", sidebar: "#0f172a" },
    defaultModules: ["leads", "campaigns", "conversations", "tasks", "analytics"],
    pipelineStages: ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"],
    terminology: {
      lead: "Lead",
      leadPlural: "Leads",
      customer: "Customer",
      deal: "Deal",
      pipeline: "Pipeline",
    },
  },
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
  gym: {
    key: "gym",
    name: "Gym & Fitness",
    tagline: "Conversion, retention, transformation",
    description:
      "Built around member follow-up, at-risk prediction, trainer performance, and goal tracking. Members, not leads.",
    theme: { primary: "#f97316", accent: "#fb923c", sidebar: "#1c1917" },
    defaultModules: ["leads", "campaigns", "conversations", "appointments", "analytics"],
    pipelineStages: [
      "New Inquiry",
      "Tour Booked",
      "Trial Started",
      "Member",
      "At Risk",
      "Cancelled",
    ],
    terminology: {
      lead: "Prospect",
      leadPlural: "Prospects",
      customer: "Member",
      deal: "Membership",
      pipeline: "Member Funnel",
    },
  },
  solar: {
    key: "solar",
    name: "Solar Installation",
    tagline: "Site survey to permission-to-operate",
    description:
      "Track homeowners from initial inquiry through site survey, design, install, and PTO with utility-specific fields.",
    theme: { primary: "#eab308", accent: "#facc15", sidebar: "#1a1505" },
    defaultModules: ["leads", "campaigns", "conversations", "appointments", "analytics"],
    pipelineStages: [
      "New Lead",
      "Site Survey",
      "Design",
      "Proposal Sent",
      "Contract Signed",
      "Permitting",
      "Installed",
      "PTO",
      "Lost",
    ],
    terminology: {
      lead: "Lead",
      leadPlural: "Leads",
      customer: "Homeowner",
      deal: "Project",
      pipeline: "Install Pipeline",
    },
  },
  real_estate: {
    key: "real_estate",
    name: "Real Estate",
    tagline: "Buyers, sellers, listings, closings",
    description:
      "Buyer and seller pipelines, showing tracking, listing statuses, and commission splits — built for agents and teams.",
    theme: { primary: "#0ea5e9", accent: "#38bdf8", sidebar: "#0c1f33" },
    defaultModules: ["leads", "campaigns", "conversations", "appointments", "analytics"],
    pipelineStages: [
      "New Lead",
      "Qualified",
      "Showing",
      "Offer",
      "Under Contract",
      "Closed",
      "Lost",
    ],
    terminology: {
      lead: "Lead",
      leadPlural: "Leads",
      customer: "Client",
      deal: "Transaction",
      pipeline: "Deal Pipeline",
    },
  },
  insurance: {
    key: "insurance",
    name: "Insurance",
    tagline: "Quote → bind → renew",
    description:
      "Policy pipelines, quote tracking, binders, renewals, and commission schedules for agencies and brokers.",
    theme: { primary: "#6366f1", accent: "#818cf8", sidebar: "#13133a" },
    defaultModules: ["leads", "campaigns", "conversations", "tasks", "analytics", "commissions"],
    pipelineStages: [
      "New Lead",
      "Quoted",
      "Application",
      "Underwriting",
      "Bound",
      "Active Policy",
      "Renewal",
      "Lost",
    ],
    terminology: {
      lead: "Prospect",
      leadPlural: "Prospects",
      customer: "Policyholder",
      deal: "Policy",
      pipeline: "Policy Pipeline",
    },
  },
};

export const INDUSTRY_LIST: IndustryTemplate[] = Object.values(INDUSTRY_TEMPLATES);

export function getTemplate(key: string | null | undefined): IndustryTemplate {
  if (!key) return INDUSTRY_TEMPLATES.general;
  return INDUSTRY_TEMPLATES[key as IndustryKey] ?? INDUSTRY_TEMPLATES.general;
}
