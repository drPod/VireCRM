export type CampaignStatus = "Active" | "Paused" | "Scheduled" | "Completed" | "Draft";

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: "Email" | "SMS" | "Multi-channel" | "WhatsApp";
  audience: string;
  sent: number;
  opened: number;
  replied: number;
  booked: number;
  launched: string;
}

export const CAMPAIGNS: Campaign[] = [
  { id: "C-301", name: "Q2 Solar — Reactivation", status: "Active", channel: "Multi-channel", audience: "Cold solar leads · 6+ mo", sent: 1284, opened: 612, replied: 84, booked: 19, launched: "May 3" },
  { id: "C-302", name: "Energy Executives — H2 Outreach", status: "Active", channel: "Email", audience: "Energy sector VP+", sent: 942, opened: 488, replied: 67, booked: 14, launched: "May 6" },
  { id: "C-303", name: "Real Estate — Spring Open House Push", status: "Active", channel: "SMS", audience: "Realty leads · NY + NJ", sent: 2104, opened: 1820, replied: 211, booked: 38, launched: "Apr 28" },
  { id: "C-304", name: "Gym Owners — Black Friday Tease", status: "Scheduled", channel: "Email", audience: "Gym + fitness verticals", sent: 0, opened: 0, replied: 0, booked: 0, launched: "Nov 22" },
  { id: "C-305", name: "Insurance Brokers — Quarterly Check-in", status: "Paused", channel: "WhatsApp", audience: "Existing insurance customers", sent: 348, opened: 281, replied: 47, booked: 9, launched: "Apr 12" },
  { id: "C-306", name: "Logistics — Q1 Renewals", status: "Completed", channel: "Multi-channel", audience: "Logistics MRR <12mo", sent: 612, opened: 401, replied: 92, booked: 27, launched: "Jan 8" },
  { id: "C-307", name: "Solar — White-label Demo Invite", status: "Active", channel: "Email", audience: "Solar installers", sent: 184, opened: 122, replied: 28, booked: 7, launched: "May 10" },
  { id: "C-308", name: "Gym — Reactivation (lapsed)", status: "Draft", channel: "SMS", audience: "Gym leads · churned 60+d", sent: 0, opened: 0, replied: 0, booked: 0, launched: "—" },
];
