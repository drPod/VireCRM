import type { ProviderConfig } from "@/types/integrations";

/**
 * Static configuration for every BYO provider rendered in the Integrations
 * settings tab. The shape lives in `src/types/integrations.ts`.
 *
 * Adding a provider here automatically wires it into the cards grid
 * rendered by `IntegrationsSettings` — no code change required.
 */
export const PROVIDERS: ProviderConfig[] = [
  {
    id: "apollo",
    name: "Apollo.io",
    description:
      "Powers Auto-Find Leads with real, verified B2B contacts from Apollo's 275M+ database. Each lead consumes 1 Apollo email credit.",
    docsUrl: "https://app.apollo.io/#/settings/integrations/api",
    inputHint: "Paste your Apollo API key here",
    connectedDescription: "Auto-Find Leads will now pull real verified contacts.",
    removeConfirm:
      "Auto-Find Leads will fall back to platform credits, or stop working if you have none.",
    setupSteps: [
      'Click "Get API key" above — it opens Apollo in a new tab.',
      "Sign in to your Apollo account (or create one — the free plan works).",
      'On the API keys page, click "Create new key" and give it a name like "VireCRM".',
      'Copy the long key that starts with letters and numbers, then paste it below and click "Connect".',
    ],
  },
  {
    id: "hunter",
    name: "Hunter.io",
    description:
      "Cheaper domain-search alternative. Find every public email at a company domain — great for outreach to specific accounts.",
    docsUrl: "https://hunter.io/api-keys",
    inputHint: "Paste your Hunter API key here",
    connectedDescription: "Hunter.io is now selectable in Auto-Find Leads.",
    removeConfirm: "Domain searches via Hunter will stop working.",
    setupSteps: [
      'Click "Get API key" above — it opens Hunter in a new tab.',
      "Sign in (the free plan includes 25 searches per month).",
      "You'll see your API key listed at the top of the page — copy it.",
      'Paste it below and click "Connect".',
    ],
  },
  {
    id: "snov",
    name: "Snov.io",
    description:
      "Cheapest per-email provider. Find emails by company domain. Best value if you're sending lots of outreach.",
    docsUrl: "https://app.snov.io/account#/api",
    inputHint: "Paste your Client ID",
    connectedDescription: "Snov.io is now selectable in Auto-Find Leads.",
    removeConfirm: "Domain searches via Snov will stop working.",
    setupSteps: [
      'Click "Get API key" above — it opens Snov.io in a new tab.',
      "Sign in to your Snov account.",
      'On the API page you\'ll see two values: "User ID" and "Secret". Copy them both.',
      'Paste them in the two boxes below and click "Connect". We\'ll handle the rest.',
    ],
    twoFieldCredentials: {
      fieldOneLabel: "User ID (also called Client ID)",
      fieldOnePlaceholder: "e.g. 1a2b3c4d5e6f7g8h9i0j",
      fieldTwoLabel: "Secret",
      fieldTwoPlaceholder: "e.g. abc123def456ghi789",
      joiner: ":",
    },
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description:
      "Send transactional and outreach emails through SendGrid. Best for teams that already use SendGrid for their app email.",
    docsUrl: "https://app.sendgrid.com/settings/api_keys",
    inputHint: "Paste your SendGrid API key (starts with SG.)",
    connectedDescription: "SendGrid is now available as an email channel on each lead.",
    removeConfirm: "Outreach emails sent via SendGrid will stop working.",
    setupSteps: [
      'Click "Get API key" above — it opens SendGrid in a new tab.',
      "Sign in to your SendGrid account (the free plan includes 100 emails/day).",
      'Go to Settings → API Keys → "Create API Key". Choose "Restricted Access" and tick at least the "Mail Send" permission.',
      "Verify a sender domain or single sender (Settings → Sender Authentication) — SendGrid will refuse mail from unverified addresses.",
      'Copy the key (it starts with "SG.") and paste it below. Then add a "Send-from address" so we know which verified address to send from.',
    ],
    settingsFields: [
      {
        key: "defaultFromAddress",
        label: "Send-from address",
        placeholder: "you@yourcompany.com",
        helper: "Must be a verified sender or domain in SendGrid, or sends will fail.",
      },
    ],
  },
];
