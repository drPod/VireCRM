export interface WorkflowStep {
  type: "trigger" | "filter" | "action" | "wait" | "branch";
  label: string;
  detail?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "Live" | "Paused" | "Draft";
  enrolled: number;
  completed: number;
  steps: WorkflowStep[];
}

export const WORKFLOWS: Workflow[] = [
  {
    id: "W-401",
    name: "Welcome new leads",
    description: "Send a 4-step warm-up sequence to every new website form submission within 12 seconds.",
    status: "Live",
    enrolled: 284,
    completed: 198,
    steps: [
      { type: "trigger", label: "New lead from website form", detail: "Source = Website" },
      { type: "wait", label: "Wait 12 seconds" },
      { type: "action", label: "Send welcome email", detail: "Template: welcome-v3" },
      { type: "wait", label: "Wait 1 day" },
      { type: "action", label: "Send case study SMS", detail: "Vertical-personalized" },
      { type: "branch", label: "If replied → notify rep · else continue" },
    ],
  },
  {
    id: "W-402",
    name: "Re-engage cold leads",
    description: "Win back leads that have gone quiet for 30+ days with a 3-touch reactivation sequence.",
    status: "Live",
    enrolled: 412,
    completed: 87,
    steps: [
      { type: "trigger", label: "Lead inactive 30 days" },
      { type: "filter", label: "Filter: score ≥ 60" },
      { type: "action", label: "AI-personalized email", detail: "Tone: warm, brief" },
      { type: "wait", label: "Wait 3 days" },
      { type: "action", label: "Send SMS check-in" },
      { type: "branch", label: "If opens or replies → move to 'Hot' nurture · else mark dormant" },
    ],
  },
  {
    id: "W-403",
    name: "Hot lead — instant notify",
    description: "Whenever the AI score crosses 85, Slack-ping the assigned rep with full context.",
    status: "Live",
    enrolled: 47,
    completed: 47,
    steps: [
      { type: "trigger", label: "Score crosses 85" },
      { type: "filter", label: "Filter: owner assigned" },
      { type: "action", label: "Slack ping rep with summary" },
      { type: "action", label: "Create task: 'Call within 1h'" },
    ],
  },
  {
    id: "W-404",
    name: "Birthday touch",
    description: "Send a personalized congrats note with a 10% discount code on every customer's birthday.",
    status: "Paused",
    enrolled: 132,
    completed: 91,
    steps: [
      { type: "trigger", label: "Birthday = today" },
      { type: "action", label: "Send email with coupon" },
      { type: "wait", label: "Wait 2 days" },
      { type: "branch", label: "If unused → SMS reminder · else done" },
    ],
  },
];
