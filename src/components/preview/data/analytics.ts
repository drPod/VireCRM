export interface FunnelStage {
  name: string;
  count: number;
  rate: number;
}

export const FUNNEL: FunnelStage[] = [
  { name: "Leads in", count: 4218, rate: 100 },
  { name: "Engaged", count: 2640, rate: 62.6 },
  { name: "Qualified", count: 1184, rate: 28.1 },
  { name: "Proposal", count: 478, rate: 11.3 },
  { name: "Won", count: 187, rate: 4.4 },
];

export interface RepPerformance {
  name: string;
  initials: string;
  closed: number;
  pipeline: number;
  responseMin: number;
  winRate: number;
}

export const REPS: RepPerformance[] = [
  { name: "Mia Rivera", initials: "MR", closed: 18, pipeline: 142000, responseMin: 1.8, winRate: 38 },
  { name: "Jamie Kahn", initials: "JK", closed: 14, pipeline: 198000, responseMin: 2.4, winRate: 33 },
  { name: "Devon Tate", initials: "DT", closed: 11, pipeline: 87000, responseMin: 3.1, winRate: 29 },
  { name: "Priya Shah", initials: "PS", closed: 4, pipeline: 41000, responseMin: 4.6, winRate: 22 },
];

export const CHANNEL_BREAKDOWN = [
  { channel: "Email", sent: 4218, replied: 612, rate: 14.5 },
  { channel: "SMS", sent: 2104, replied: 487, rate: 23.1 },
  { channel: "WhatsApp", sent: 612, replied: 184, rate: 30.1 },
  { channel: "Instagram", sent: 384, replied: 84, rate: 21.9 },
];
