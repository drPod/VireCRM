export interface AdvisorTurn {
  id: string;
  role: "user" | "assistant";
  body: string;
  citations?: string[];
  actions?: { label: string; kind: "draft" | "run" | "open" }[];
}

export const ADVISOR_TURNS: AdvisorTurn[] = [
  {
    id: "t1",
    role: "user",
    body: "Find me my hottest energy leads this week.",
  },
  {
    id: "t2",
    role: "assistant",
    body: "I found 4 energy leads with score ≥ 85 and recent activity in the last 7 days:\n\n• **Marcus Webb (Northwind Energy)** — score 88, proposal stage, $58k value, replied 12m ago asking to reschedule demo to Thursday.\n• **Yuki Tanaka (Kobe Energy)** — score 89, contacted stage, $67k value, OOO until Monday — sequence auto-paused.\n• **Felix Andersson (Malmö Energy)** — score 90, qualified stage, $56.8k value, said \"loved the demo\" yesterday — contract pending.\n• **Mei Chen (Mei Energy Co.)** — score 70, just opted in 45m ago, $27.3k estimated value.\n\nMarcus and Felix are most likely to close this week. Want me to draft outreach?",
    citations: ["L-1042", "L-1051", "L-1066", "L-1059"],
    actions: [
      { label: "Draft Marcus follow-up", kind: "draft" },
      { label: "Open Felix contract thread", kind: "open" },
      { label: "Enroll Mei in welcome workflow", kind: "run" },
    ],
  },
  {
    id: "t3",
    role: "user",
    body: "Draft a follow-up to Marcus moving the demo to Thursday.",
  },
  {
    id: "t4",
    role: "assistant",
    body: "Here's a draft based on his last message and the proposal context:\n\n> **Subject:** Thursday works — locking it in\n>\n> Hi Marcus,\n>\n> Thursday is good on my end. Let's lock 10am ET — I'll loop in our solutions engineer too so we can dig into the integration questions your COO flagged.\n>\n> I'll send the calendar invite right after this. If 10am doesn't work for your COO, 2pm is also open.\n>\n> Best,\n> Mia\n\nThis matches your usual tone (short, second-person, no exclamation marks). Send as-is, edit, or regenerate?",
    actions: [
      { label: "Send as-is", kind: "run" },
      { label: "Edit draft", kind: "open" },
      { label: "Regenerate", kind: "draft" },
    ],
  },
];

export const ADVISOR_PROMPT_CARDS = [
  { id: "p1", title: "Find hot leads", body: "Surface leads ready to close this week", icon: "Flame" },
  { id: "p2", title: "Draft follow-ups", body: "Write personalized outreach for stuck deals", icon: "PenLine" },
  { id: "p3", title: "Forecast Q2 close rate", body: "Range-bound forecast based on current pipeline", icon: "TrendingUp" },
  { id: "p4", title: "Find at-risk customers", body: "Spot customers showing churn signals", icon: "AlertTriangle" },
];
