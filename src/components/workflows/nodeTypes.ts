import {
  Zap,
  GitBranch,
  Mail,
  MessageSquare,
  Clock,
  Tag,
  Users,
  Sparkles,
  Bot,
  ScanText,
  Wand2,
  CalendarPlus,
  type LucideIcon,
} from "lucide-react";

export type WorkflowNodeKind =
  | "trigger.lead_created"
  | "trigger.status_changed"
  | "trigger.message_received"
  | "action.send_email"
  | "action.add_tag"
  | "action.wait"
  | "action.branch"
  | "action.score_lead"
  | "action.classify_reply"
  | "action.personalize_message"
  | "action.book_appointment";

export interface NodeTypeMeta {
  kind: WorkflowNodeKind;
  category: "trigger" | "action" | "logic" | "ai";
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
  // ---- AI agents ----
  {
    kind: "action.score_lead",
    category: "ai",
    label: "AI: Score lead",
    description: "Score lead 0-100 with rationale",
    icon: Sparkles,
    defaultConfig: { agent: "score-lead" },
  },
  {
    kind: "action.classify_reply",
    category: "ai",
    label: "AI: Classify reply",
    description: "Detect intent + sentiment + urgency",
    icon: ScanText,
    defaultConfig: { agent: "classify-reply", source: "last_message" },
  },
  {
    kind: "action.personalize_message",
    category: "ai",
    label: "AI: Personalize message",
    description: "Rewrite a template for this lead",
    icon: Wand2,
    defaultConfig: {
      agent: "personalize-message",
      subject: "",
      body: "",
      tone: "warm, professional",
    },
  },
  {
    kind: "action.book_appointment",
    category: "ai",
    label: "AI: Book appointment",
    description: "Propose or auto-book a slot",
    icon: CalendarPlus,
    defaultConfig: {
      agent: "book-appointment",
      duration_minutes: 30,
      auto_book: false,
    },
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

/**
 * AI agent node kinds → edge function name. Workflow runner invokes these
 * via supabase.functions.invoke(name, { body: { lead_id, ...config } }).
 */
export const AGENT_KIND_TO_FUNCTION: Partial<Record<WorkflowNodeKind, string>> = {
  "action.score_lead": "score-lead",
  "action.classify_reply": "classify-reply",
  "action.personalize_message": "personalize-message",
  "action.book_appointment": "book-appointment",
};

// Re-export icon for ai category in palette consumers (tree-shake safe).
export { Bot };
