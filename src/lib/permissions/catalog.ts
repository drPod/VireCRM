// Master catalog of granular permissions used by the custom-roles system.
// Keep keys in sync with public.user_has_permission() in the database.

export type PermissionKey =
  | "leads.view"
  | "leads.create"
  | "leads.update"
  | "leads.delete"
  | "leads.assign"
  | "campaigns.view"
  | "campaigns.manage"
  | "tasks.view"
  | "tasks.manage"
  | "commissions.view"
  | "commissions.manage"
  | "expenses.view"
  | "expenses.manage"
  | "team.manage"
  | "settings.manage"
  | "billing.manage"
  | "reports.view"
  | "integrations.manage";

export interface PermissionDef {
  key: PermissionKey;
  group: string;
  label: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDef[] = [
  // Leads
  { key: "leads.view", group: "Leads", label: "View leads", description: "See the lead list and pipeline." },
  { key: "leads.create", group: "Leads", label: "Create leads", description: "Add new leads manually or via import." },
  { key: "leads.update", group: "Leads", label: "Edit leads", description: "Update lead details, status, and notes." },
  { key: "leads.delete", group: "Leads", label: "Delete leads", description: "Permanently remove leads." },
  { key: "leads.assign", group: "Leads", label: "Assign leads", description: "Reassign leads to other team members." },

  // Campaigns
  { key: "campaigns.view", group: "Campaigns", label: "View campaigns", description: "See outreach campaigns and stats." },
  { key: "campaigns.manage", group: "Campaigns", label: "Manage campaigns", description: "Create, edit, and launch campaigns." },

  // Tasks
  { key: "tasks.view", group: "Tasks", label: "View tasks", description: "See team tasks and the calendar." },
  { key: "tasks.manage", group: "Tasks", label: "Manage tasks", description: "Create, assign, and complete tasks." },

  // Commissions
  { key: "commissions.view", group: "Commissions", label: "View commissions", description: "See own commission earnings." },
  { key: "commissions.manage", group: "Commissions", label: "Manage commissions", description: "Configure rules and mark commissions paid." },

  // Expenses
  { key: "expenses.view", group: "Expenses", label: "View expenses", description: "See logged expenses." },
  { key: "expenses.manage", group: "Expenses", label: "Manage expenses", description: "Add and edit expenses." },

  // Team & settings
  { key: "team.manage", group: "Team", label: "Manage team", description: "Invite, remove, and re-role members." },
  { key: "settings.manage", group: "Settings", label: "Manage settings", description: "Edit org, branding, and email settings." },
  { key: "billing.manage", group: "Settings", label: "Manage billing", description: "Access billing portal and subscription." },
  { key: "integrations.manage", group: "Settings", label: "Manage integrations", description: "Connect and configure integrations." },

  // Reports
  { key: "reports.view", group: "Reports", label: "View reports", description: "Access analytics and revenue dashboards." },
];

export const PERMISSION_GROUPS = Array.from(
  new Set(PERMISSION_CATALOG.map((p) => p.group)),
);

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_CATALOG.map((p) => p.key);
