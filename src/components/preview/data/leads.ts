export type LeadStatus = "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost";
export type LeadSource =
  | "Website"
  | "Referral"
  | "Cold Outreach"
  | "Trade Show"
  | "Paid Ads"
  | "LinkedIn";

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  status: LeadStatus;
  source: LeadSource;
  value: number;
  score: number;
  initials: string;
  owner: string;
  lastTouch: string;
  vertical: "Energy" | "Solar" | "Real Estate" | "Insurance" | "Gym" | "Logistics" | "Tech";
}

export const LEADS: Lead[] = [
  { id: "L-1041", name: "Sarah Chen", email: "sarah@apexlogistics.com", company: "Apex Logistics", status: "Qualified", source: "Website", value: 24500, score: 92, initials: "SC", owner: "Mia R.", lastTouch: "2m ago", vertical: "Logistics" },
  { id: "L-1042", name: "Marcus Webb", email: "marcus@northwindenergy.com", company: "Northwind Energy", status: "Proposal", source: "Referral", value: 58000, score: 88, initials: "MW", owner: "Jamie K.", lastTouch: "12m ago", vertical: "Energy" },
  { id: "L-1043", name: "Priya Patel", email: "priya@blueriver.io", company: "BlueRiver Tech", status: "Contacted", source: "LinkedIn", value: 12300, score: 76, initials: "PP", owner: "Mia R.", lastTouch: "1h ago", vertical: "Tech" },
  { id: "L-1044", name: "David Okafor", email: "david@helixmfg.com", company: "Helix Manufacturing", status: "Qualified", source: "Trade Show", value: 41200, score: 84, initials: "DO", owner: "Devon T.", lastTouch: "3h ago", vertical: "Logistics" },
  { id: "L-1045", name: "Emma Lindqvist", email: "emma@polaris-retail.se", company: "Polaris Retail Group", status: "New", source: "Website", value: 8900, score: 68, initials: "EL", owner: "—", lastTouch: "12m ago", vertical: "Tech" },
  { id: "L-1046", name: "Luis Romero", email: "luis@solaraz.com", company: "Solar Arizona Co.", status: "Proposal", source: "Paid Ads", value: 47800, score: 91, initials: "LR", owner: "Jamie K.", lastTouch: "20m ago", vertical: "Solar" },
  { id: "L-1047", name: "Anna Müller", email: "anna@hessenrealty.de", company: "Hessen Realty", status: "Contacted", source: "Referral", value: 31000, score: 79, initials: "AM", owner: "Mia R.", lastTouch: "2h ago", vertical: "Real Estate" },
  { id: "L-1048", name: "Tomás Silva", email: "tomas@silvainsurance.pt", company: "Silva Insurance", status: "New", source: "Cold Outreach", value: 19200, score: 64, initials: "TS", owner: "—", lastTouch: "30m ago", vertical: "Insurance" },
  { id: "L-1049", name: "Aisha Khan", email: "aisha@fitcorenyc.com", company: "FitCore NYC", status: "Won", source: "Paid Ads", value: 16400, score: 95, initials: "AK", owner: "Devon T.", lastTouch: "yesterday", vertical: "Gym" },
  { id: "L-1050", name: "Brendan O'Hara", email: "brendan@oharasolar.ie", company: "O'Hara Solar", status: "Qualified", source: "Trade Show", value: 38000, score: 87, initials: "BO", owner: "Jamie K.", lastTouch: "4h ago", vertical: "Solar" },
  { id: "L-1051", name: "Yuki Tanaka", email: "yuki@kobeenergy.jp", company: "Kobe Energy", status: "Contacted", source: "LinkedIn", value: 67000, score: 89, initials: "YT", owner: "Mia R.", lastTouch: "5h ago", vertical: "Energy" },
  { id: "L-1052", name: "Carlos Mendes", email: "carlos@lisbonproperties.pt", company: "Lisbon Properties", status: "New", source: "Website", value: 22500, score: 72, initials: "CM", owner: "—", lastTouch: "1h ago", vertical: "Real Estate" },
  { id: "L-1053", name: "Hannah Goldberg", email: "hannah@stridegym.com", company: "Stride Gym", status: "Proposal", source: "Referral", value: 14800, score: 83, initials: "HG", owner: "Devon T.", lastTouch: "6h ago", vertical: "Gym" },
  { id: "L-1054", name: "Mateo Rossi", email: "mateo@rossiins.it", company: "Rossi Insurance Group", status: "Qualified", source: "Cold Outreach", value: 52600, score: 86, initials: "MR", owner: "Jamie K.", lastTouch: "yesterday", vertical: "Insurance" },
  { id: "L-1055", name: "Olivia Park", email: "olivia@parklogistics.ca", company: "Park Logistics CA", status: "Lost", source: "LinkedIn", value: 0, score: 41, initials: "OP", owner: "Mia R.", lastTouch: "2d ago", vertical: "Logistics" },
  { id: "L-1056", name: "Kenji Watanabe", email: "kenji@tokyofit.jp", company: "Tokyo Fit", status: "Contacted", source: "Paid Ads", value: 18900, score: 74, initials: "KW", owner: "Devon T.", lastTouch: "7h ago", vertical: "Gym" },
  { id: "L-1057", name: "Sofia Hernandez", email: "sofia@solarvalencia.es", company: "Solar Valencia", status: "Won", source: "Trade Show", value: 71200, score: 96, initials: "SH", owner: "Jamie K.", lastTouch: "2d ago", vertical: "Solar" },
  { id: "L-1058", name: "Noah Becker", email: "noah@beckerproperties.at", company: "Becker Properties", status: "Proposal", source: "Referral", value: 33700, score: 85, initials: "NB", owner: "Mia R.", lastTouch: "8h ago", vertical: "Real Estate" },
  { id: "L-1059", name: "Mei Chen", email: "mei@meienergy.tw", company: "Mei Energy Co.", status: "New", source: "Website", value: 27300, score: 70, initials: "MC", owner: "—", lastTouch: "45m ago", vertical: "Energy" },
  { id: "L-1060", name: "Adam Kowalski", email: "adam@kowalskitech.pl", company: "Kowalski Tech", status: "Qualified", source: "Cold Outreach", value: 19400, score: 81, initials: "AK", owner: "Devon T.", lastTouch: "9h ago", vertical: "Tech" },
  { id: "L-1061", name: "Lucia Romano", email: "lucia@romanofitness.it", company: "Romano Fitness", status: "Contacted", source: "LinkedIn", value: 11200, score: 69, initials: "LR", owner: "Devon T.", lastTouch: "yesterday", vertical: "Gym" },
  { id: "L-1062", name: "Daniel Singh", email: "daniel@singhinsure.uk", company: "Singh Insure UK", status: "Proposal", source: "Paid Ads", value: 46100, score: 87, initials: "DS", owner: "Jamie K.", lastTouch: "11h ago", vertical: "Insurance" },
  { id: "L-1063", name: "Maya Williams", email: "maya@williams-realty.us", company: "Williams Realty", status: "Won", source: "Referral", value: 29400, score: 94, initials: "MW", owner: "Mia R.", lastTouch: "3d ago", vertical: "Real Estate" },
  { id: "L-1064", name: "Igor Petrov", email: "igor@petrovgroup.ee", company: "Petrov Group", status: "Lost", source: "Cold Outreach", value: 0, score: 38, initials: "IP", owner: "Devon T.", lastTouch: "4d ago", vertical: "Logistics" },
  { id: "L-1065", name: "Chloe Dubois", email: "chloe@parisrenov.fr", company: "Paris Renov", status: "New", source: "Website", value: 24800, score: 73, initials: "CD", owner: "—", lastTouch: "20m ago", vertical: "Real Estate" },
  { id: "L-1066", name: "Felix Andersson", email: "felix@malmoenergy.se", company: "Malmö Energy", status: "Qualified", source: "Trade Show", value: 56800, score: 90, initials: "FA", owner: "Jamie K.", lastTouch: "13h ago", vertical: "Energy" },
  { id: "L-1067", name: "Zara Ahmed", email: "zara@dubaifit.ae", company: "Dubai Fit Co.", status: "Contacted", source: "Paid Ads", value: 13700, score: 77, initials: "ZA", owner: "Devon T.", lastTouch: "yesterday", vertical: "Gym" },
  { id: "L-1068", name: "Henrik Berg", email: "henrik@bergsolar.no", company: "Berg Solar", status: "Proposal", source: "Referral", value: 39200, score: 86, initials: "HB", owner: "Jamie K.", lastTouch: "14h ago", vertical: "Solar" },
  { id: "L-1069", name: "Beatriz Costa", email: "beatriz@costainsure.br", company: "Costa Insure", status: "New", source: "LinkedIn", value: 17600, score: 67, initials: "BC", owner: "—", lastTouch: "30m ago", vertical: "Insurance" },
  { id: "L-1070", name: "Ethan Brooks", email: "ethan@brookslogistics.com", company: "Brooks Logistics", status: "Won", source: "Cold Outreach", value: 84300, score: 97, initials: "EB", owner: "Mia R.", lastTouch: "4d ago", vertical: "Logistics" },
];

export function leadCountByStatus(): Record<LeadStatus, number> {
  return LEADS.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    },
    { New: 0, Contacted: 0, Qualified: 0, Proposal: 0, Won: 0, Lost: 0 } as Record<LeadStatus, number>,
  );
}
