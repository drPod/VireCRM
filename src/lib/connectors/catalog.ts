/**
 * Catalog of every Lovable Connector we expose in Settings → Integrations.
 *
 * The Lovable Connector Gateway holds the OAuth tokens — we never store
 * provider credentials in our DB. Each entry here just declares:
 *   - the connector_id (used by the standard_connectors flow + gateway URL)
 *   - the env var the server runtime sees once a connection is linked
 *   - what categories / capabilities to surface in the UI
 *
 * Adding a new connector:
 *   1. Add a row here.
 *   2. (Optional) Implement an action fn in src/functions/connectors/*.functions.ts.
 *   3. Wire it into LeadDetailDrawer or wherever it should appear.
 */

export type ConnectorCategory = "email_calendar" | "communication" | "crm_data" | "productivity";

export type ConnectorCapability =
  | "send_message" // outbound chat / channel
  | "send_email" // outbound email
  | "send_sms" // outbound SMS
  | "schedule_event" // create calendar event
  | "sync_contacts" // pull contacts in
  | "sync_messages" // pull messages in
  | "create_doc" // create a doc/file
  | "create_task"; // create a task/issue

export interface ConnectorConfigField {
  /** Key written to org_connectors.config jsonb. */
  key: string;
  /** Form label. */
  label: string;
  /** Placeholder + helper hint. */
  placeholder?: string;
  helper?: string;
}

export interface ConnectorMeta {
  /** Stable id used as the `provider` column in `org_connectors`. */
  id: string;
  /** Connector id passed to standard_connectors--connect + gateway URL. */
  connectorId: string;
  /** The env var name the gateway injects when this connector is linked. */
  envVar: string;
  /** Display label. */
  name: string;
  /** Short pitch shown under the name. */
  description: string;
  category: ConnectorCategory;
  capabilities: ConnectorCapability[];
  /** Provider docs / help link. */
  docsUrl: string;
  /** Status: "live" = action fns implemented; "beta" = enable-only for now. */
  status: "live" | "beta";
  /** Optional editable config (default channel, mailbox, etc.). */
  configFields?: ConnectorConfigField[];
}

export const CONNECTORS: ConnectorMeta[] = [
  // ===== Email & Calendar =====
  {
    id: "gmail",
    connectorId: "google_mail",
    envVar: "GOOGLE_MAIL_API_KEY",
    name: "Gmail",
    description: "Send outreach emails from your own Gmail account. Replies land in your inbox.",
    category: "email_calendar",
    capabilities: ["send_email"],
    docsUrl: "https://developers.google.com/gmail/api",
    status: "live",
    configFields: [
      {
        key: "fromAddress",
        label: "Send from address",
        placeholder: "you@gmail.com",
        helper: "The Gmail address outreach emails will appear to come from. Usually your own.",
      },
    ],
  },
  {
    id: "microsoft_outlook",
    connectorId: "microsoft_outlook",
    envVar: "MICROSOFT_OUTLOOK_API_KEY",
    name: "Microsoft Outlook",
    description: "Send outreach emails from your Outlook / Microsoft 365 mailbox.",
    category: "email_calendar",
    capabilities: ["send_email"],
    docsUrl: "https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview",
    status: "live",
    configFields: [
      {
        key: "fromAddress",
        label: "Send from address",
        placeholder: "you@company.com",
        helper: "The mailbox outreach emails will appear to come from.",
      },
    ],
  },
  {
    id: "google_calendar",
    connectorId: "google_calendar",
    envVar: "GOOGLE_CALENDAR_API_KEY",
    name: "Google Calendar",
    description: "Book meetings with leads in one click — they get a Calendar invite by email.",
    category: "email_calendar",
    capabilities: ["schedule_event"],
    docsUrl: "https://developers.google.com/calendar",
    status: "live",
    configFields: [
      {
        key: "defaultDurationMinutes",
        label: "Default meeting length (minutes)",
        placeholder: "30",
        helper: "Pre-fills the duration when you schedule a meeting.",
      },
      {
        key: "timeZone",
        label: "Time zone",
        placeholder: "America/Chicago",
        helper: "IANA time zone, e.g. America/New_York or Europe/London.",
      },
      {
        key: "defaultCalendarId",
        label: "Calendar ID (optional)",
        placeholder: "primary",
        helper: "Leave as 'primary' for your main calendar, or paste a calendar ID.",
      },
    ],
  },

  // ===== Communication =====
  {
    id: "slack",
    connectorId: "slack",
    envVar: "SLACK_API_KEY",
    name: "Slack",
    description:
      "Notify a channel when leads are won, lost, or assigned. Send messages from a lead.",
    category: "communication",
    capabilities: ["send_message"],
    docsUrl: "https://api.slack.com",
    status: "live",
    configFields: [
      {
        key: "defaultChannel",
        label: "Default channel",
        placeholder: "#sales",
        helper: "Channel posts go to when nothing more specific is selected.",
      },
    ],
  },
  {
    id: "microsoft_teams",
    connectorId: "microsoft_teams",
    envVar: "MICROSOFT_TEAMS_API_KEY",
    name: "Microsoft Teams",
    description: "Post lead updates to a Teams channel.",
    category: "communication",
    capabilities: ["send_message"],
    docsUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/",
    status: "live",
    configFields: [
      { key: "teamId", label: "Team ID", placeholder: "00000000-…" },
      { key: "channelId", label: "Channel ID", placeholder: "19:abc…@thread.tacv2" },
    ],
  },
  {
    id: "twilio",
    connectorId: "twilio",
    envVar: "TWILIO_API_KEY",
    name: "Twilio SMS",
    description: "Send SMS outreach to leads with phone numbers.",
    category: "communication",
    capabilities: ["send_sms"],
    docsUrl: "https://www.twilio.com/docs/sms",
    status: "live",
    configFields: [
      {
        key: "fromNumber",
        label: "Send-from phone number",
        placeholder: "+15551234567",
        helper: "Twilio number SMS will be sent from. E.164 format.",
      },
    ],
  },

  // ===== CRM / Data =====
  {
    id: "hubspot",
    connectorId: "hubspot",
    envVar: "HUBSPOT_API_KEY",
    name: "HubSpot",
    description: "Pull contacts from HubSpot in as leads. Two-way sync coming soon.",
    category: "crm_data",
    capabilities: ["sync_contacts"],
    docsUrl: "https://developers.hubspot.com/docs/api/overview",
    status: "live",
    configFields: [
      {
        key: "importLimit",
        label: "Contacts per sync",
        placeholder: "25",
        helper: "Max contacts pulled in each manual sync. Default 25.",
      },
    ],
  },

  // ===== Productivity =====
  {
    id: "google_drive",
    connectorId: "google_drive",
    envVar: "GOOGLE_DRIVE_API_KEY",
    name: "Google Drive",
    description: "Attach documents and proposals from Drive to leads.",
    category: "productivity",
    capabilities: ["create_doc"],
    docsUrl: "https://developers.google.com/drive",
    status: "beta",
  },
  {
    id: "notion",
    connectorId: "notion",
    envVar: "NOTION_API_KEY",
    name: "Notion",
    description: "Create lead notes / account briefs in your Notion workspace.",
    category: "productivity",
    capabilities: ["create_doc"],
    docsUrl: "https://developers.notion.com",
    status: "beta",
  },
  {
    id: "linear",
    connectorId: "linear",
    envVar: "LINEAR_API_KEY",
    name: "Linear",
    description: "File feature requests / blockers as Linear issues from a lead.",
    category: "productivity",
    capabilities: ["create_task"],
    docsUrl: "https://developers.linear.app",
    status: "live",
  },
];

export const CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  email_calendar: "Email & Calendar",
  communication: "Communication",
  crm_data: "CRM & Data",
  productivity: "Productivity",
};

export const CATEGORY_DESCRIPTIONS: Record<ConnectorCategory, string> = {
  email_calendar: "Send tracked emails and book meetings without leaving the CRM.",
  communication: "Notify your team and reach leads where they already chat.",
  crm_data: "Sync contacts, accounts and deals with the tools you already use.",
  productivity: "Attach docs, file tasks and keep your knowledge base in sync.",
};

export function getConnector(id: string): ConnectorMeta | undefined {
  return CONNECTORS.find((c) => c.id === id);
}
