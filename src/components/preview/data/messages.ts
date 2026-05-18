export type Channel = "email" | "sms" | "whatsapp" | "instagram";

export interface Message {
  id: string;
  sender: "lead" | "you" | "ai";
  body: string;
  time: string;
  channel: Channel;
}

export interface Thread {
  id: string;
  leadId: string;
  name: string;
  company: string;
  initials: string;
  channel: Channel;
  preview: string;
  unread: boolean;
  lastTime: string;
  status: "hot" | "interested" | "objection" | "out-of-office" | "neutral";
  messages: Message[];
}

export const THREADS: Thread[] = [
  {
    id: "T-2001",
    leadId: "L-1042",
    name: "Marcus Webb",
    company: "Northwind Energy",
    initials: "MW",
    channel: "email",
    preview: "Can we move the demo to Thursday? I've looped in our COO.",
    unread: true,
    lastTime: "12m",
    status: "hot",
    messages: [
      { id: "m1", sender: "you", body: "Hi Marcus — sending over the proposal you asked about. Let me know what you'd want to tweak.", time: "Mon 10:14am", channel: "email" },
      { id: "m2", sender: "lead", body: "Got it, thanks. Reviewing with the team now. Any chance you can do a walkthrough?", time: "Mon 4:22pm", channel: "email" },
      { id: "m3", sender: "ai", body: "Suggested reply: Offer Tuesday 2pm or Wednesday 10am — both align with his calendar and our team's free blocks.", time: "Mon 4:24pm", channel: "email" },
      { id: "m4", sender: "you", body: "Absolutely — does Tuesday 2pm or Wednesday 10am work for you?", time: "Mon 4:31pm", channel: "email" },
      { id: "m5", sender: "lead", body: "Can we move the demo to Thursday? I've looped in our COO.", time: "12m ago", channel: "email" },
    ],
  },
  {
    id: "T-2002",
    leadId: "L-1046",
    name: "Luis Romero",
    company: "Solar Arizona Co.",
    initials: "LR",
    channel: "whatsapp",
    preview: "Yes — we'd want the API access tier. What's the rate?",
    unread: true,
    lastTime: "20m",
    status: "interested",
    messages: [
      { id: "m1", sender: "lead", body: "Hey — saw the pricing page. Do you do annual?", time: "Today 9:02am", channel: "whatsapp" },
      { id: "m2", sender: "you", body: "We do — 20% off the monthly. Want me to send a quote?", time: "Today 9:11am", channel: "whatsapp" },
      { id: "m3", sender: "lead", body: "Yes — we'd want the API access tier. What's the rate?", time: "20m ago", channel: "whatsapp" },
    ],
  },
  {
    id: "T-2003",
    leadId: "L-1043",
    name: "Priya Patel",
    company: "BlueRiver Tech",
    initials: "PP",
    channel: "email",
    preview: "Thanks but we just signed with Salesforce. Maybe Q3.",
    unread: false,
    lastTime: "1h",
    status: "objection",
    messages: [
      { id: "m1", sender: "you", body: "Priya — quick follow-up on the lead-scoring demo from last week. Any thoughts?", time: "Today 8:30am", channel: "email" },
      { id: "m2", sender: "lead", body: "Thanks but we just signed with Salesforce. Maybe Q3.", time: "1h ago", channel: "email" },
      { id: "m3", sender: "ai", body: "Suggested action: Move to long-term nurture sequence. Set reminder for Q3 with Salesforce migration check-in.", time: "1h ago", channel: "email" },
    ],
  },
  {
    id: "T-2004",
    leadId: "L-1051",
    name: "Yuki Tanaka",
    company: "Kobe Energy",
    initials: "YT",
    channel: "email",
    preview: "Out of office until Monday — back next week.",
    unread: false,
    lastTime: "5h",
    status: "out-of-office",
    messages: [
      { id: "m1", sender: "you", body: "Hi Yuki — ready to set up a call next week?", time: "Today 11:30am", channel: "email" },
      { id: "m2", sender: "lead", body: "Out of office until Monday — back next week.", time: "5h ago", channel: "email" },
      { id: "m3", sender: "ai", body: "Sequence auto-paused. Will resume Monday 9am local.", time: "5h ago", channel: "email" },
    ],
  },
  {
    id: "T-2005",
    leadId: "L-1041",
    name: "Sarah Chen",
    company: "Apex Logistics",
    initials: "SC",
    channel: "sms",
    preview: "Looks great — sending to legal today.",
    unread: false,
    lastTime: "2h",
    status: "hot",
    messages: [
      { id: "m1", sender: "you", body: "Quick ping — got the redlines back from your team?", time: "Today 1:14pm", channel: "sms" },
      { id: "m2", sender: "lead", body: "Looks great — sending to legal today.", time: "2h ago", channel: "sms" },
    ],
  },
  {
    id: "T-2006",
    leadId: "L-1062",
    name: "Daniel Singh",
    company: "Singh Insure UK",
    initials: "DS",
    channel: "email",
    preview: "Can you share case studies for insurance brokers our size?",
    unread: true,
    lastTime: "3h",
    status: "interested",
    messages: [
      { id: "m1", sender: "you", body: "Hi Daniel — sending over an insurance-specific deck.", time: "Today 7:45am", channel: "email" },
      { id: "m2", sender: "lead", body: "Can you share case studies for insurance brokers our size?", time: "3h ago", channel: "email" },
    ],
  },
  {
    id: "T-2007",
    leadId: "L-1047",
    name: "Anna Müller",
    company: "Hessen Realty",
    initials: "AM",
    channel: "instagram",
    preview: "Saw your post about white-label — let's chat.",
    unread: false,
    lastTime: "4h",
    status: "neutral",
    messages: [
      { id: "m1", sender: "lead", body: "Saw your post about white-label — let's chat.", time: "4h ago", channel: "instagram" },
    ],
  },
  {
    id: "T-2008",
    leadId: "L-1066",
    name: "Felix Andersson",
    company: "Malmö Energy",
    initials: "FA",
    channel: "email",
    preview: "Loved the demo. Sending the contract over.",
    unread: false,
    lastTime: "yesterday",
    status: "hot",
    messages: [
      { id: "m1", sender: "lead", body: "Loved the demo. Sending the contract over.", time: "Yesterday 6:00pm", channel: "email" },
    ],
  },
  {
    id: "T-2009",
    leadId: "L-1054",
    name: "Mateo Rossi",
    company: "Rossi Insurance Group",
    initials: "MR",
    channel: "email",
    preview: "Need to push to next quarter — budget freeze.",
    unread: false,
    lastTime: "yesterday",
    status: "objection",
    messages: [
      { id: "m1", sender: "lead", body: "Need to push to next quarter — budget freeze.", time: "Yesterday 2:14pm", channel: "email" },
    ],
  },
  {
    id: "T-2010",
    leadId: "L-1053",
    name: "Hannah Goldberg",
    company: "Stride Gym",
    initials: "HG",
    channel: "sms",
    preview: "Booked for Friday — see you then!",
    unread: false,
    lastTime: "yesterday",
    status: "neutral",
    messages: [
      { id: "m1", sender: "lead", body: "Booked for Friday — see you then!", time: "Yesterday 5:33pm", channel: "sms" },
    ],
  },
];
