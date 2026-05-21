export interface EmailCampaign {
  id: string;
  subject: string;
  list: string;
  recipients: number;
  status: "Sent" | "Scheduled" | "Draft";
  openRate: number;
  clickRate: number;
  sentAt: string;
}

export const EMAIL_CAMPAIGNS: EmailCampaign[] = [
  { id: "E-501", subject: "How Northwind Energy cut response time by 41%", list: "Energy leads · qualified", recipients: 612, status: "Sent", openRate: 52, clickRate: 11.3, sentAt: "May 12" },
  { id: "E-502", subject: "Spring portfolio drop — 14 new listings inside", list: "Real estate · NY+NJ", recipients: 2104, status: "Sent", openRate: 38, clickRate: 6.8, sentAt: "May 10" },
  { id: "E-503", subject: "Demo Thursday — limited seats", list: "Solar installers", recipients: 184, status: "Sent", openRate: 66, clickRate: 18.1, sentAt: "May 9" },
  { id: "E-504", subject: "Quick question about your 2026 plan", list: "Insurance · churned 30+d", recipients: 412, status: "Scheduled", openRate: 0, clickRate: 0, sentAt: "May 20" },
  { id: "E-505", subject: "[Last chance] Q2 logistics renewal offer", list: "Logistics · MRR <12mo", recipients: 348, status: "Sent", openRate: 47, clickRate: 9.6, sentAt: "May 6" },
  { id: "E-506", subject: "Welcome to VireCRM — let's get you set up", list: "New signups · all", recipients: 87, status: "Sent", openRate: 91, clickRate: 73.2, sentAt: "May 14" },
  { id: "E-507", subject: "Gym owners — new auto-renewal flow", list: "Gym · all", recipients: 612, status: "Draft", openRate: 0, clickRate: 0, sentAt: "—" },
];
