import {
  Zap,
  GitBranch,
  Mail,
  MessageSquare,
  Clock,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export type WorkflowNodeKind =
  | "trigger.lead_created"
  | "trigger.status_changed"
  | "trigger.message_received"
  | "action.send_email"
  | "action.add_tag"
  | "action.wait"
  | "action.branch";

export interface NodeTypeMeta {
  kind: WorkflowNodeKind;
  category: "trigger" | "action" | "logic";
  label: string;
  description: string;
  icon: LucideIcon;
  defaultConfig: Record<string, unknown>;
}

export const NODE_TYPES: NodeTypeMeta[] = [
  {
    kind: "trigger.lead_created",
    category: "trigger",
    label: "Lead created",
    description: "Runs when a new lead is added",
    icon: Users,
    defaultConfig: {},
  },
  {
    kind: "trigger.status_changed",
    category: "trigger",
    label: "Status changed",
    description: "Runs when a lead moves stage",
    icon: Zap,
    defaultConfig: { fromStatus: "any", toStatus: "qualified" },
  },
  {
    kind: "trigger.message_received",
    category: "trigger",
    label: "Message received",
    description: "Runs on inbound reply",
    icon: MessageSquare,
    defaultConfig: { channel: "any" },
  },
  {
    kind: "action.send_email",
    category: "action",
    label: "Send email",
    description: "Send an email to the lead",
    icon: Mail,
    defaultConfig: { subject: "", body: "" },
  },
  {
    kind: "action.add_tag",
    category: "action",
    label: "Add tag",
    description: "Tag the lead",
    icon: Tag,
    defaultConfig: { tag: "" },
  },
  {
    kind: "action.wait",
    category: "action",
    label: "Wait",
    description: "Pause for a duration",
    icon: Clock,
    defaultConfig: { amount: 1, unit: "days" },
  },
  {
    kind: "action.branch",
    category: "logic",
    label: "Branch",
    description: "If/else on lead field",
    icon: GitBranch,
    defaultConfig: { field: "score", operator: ">", value: "80" },
  },
];

export const NODE_TYPE_BY_KIND: Record<WorkflowNodeKind, NodeTypeMeta> = NODE_TYPES.reduce(
  (acc, meta) => {
    acc[meta.kind] = meta;
    return acc;
  },
  {} as Record<WorkflowNodeKind, NodeTypeMeta>,
);

export const TRIGGER_KIND_TO_DB: Record<string, "lead_created" | "status_changed" | "message_received"> = {
  "trigger.lead_created": "lead_created",
  "trigger.status_changed": "status_changed",
  "trigger.message_received": "message_received",
};
