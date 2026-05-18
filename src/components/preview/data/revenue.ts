export interface RevenueMonth {
  month: string;
  mrr: number;
  newMrr: number;
  expansion: number;
  churn: number;
}

export const REVENUE: RevenueMonth[] = [
  { month: "Jun", mrr: 38200, newMrr: 6400, expansion: 1200, churn: 800 },
  { month: "Jul", mrr: 42100, newMrr: 5600, expansion: 1900, churn: 600 },
  { month: "Aug", mrr: 46400, newMrr: 7100, expansion: 2200, churn: 1400 },
  { month: "Sep", mrr: 51800, newMrr: 8900, expansion: 1800, churn: 1300 },
  { month: "Oct", mrr: 56200, newMrr: 7400, expansion: 2300, churn: 1100 },
  { month: "Nov", mrr: 62400, newMrr: 8800, expansion: 3100, churn: 700 },
  { month: "Dec", mrr: 67100, newMrr: 6800, expansion: 2900, churn: 1000 },
  { month: "Jan", mrr: 72300, newMrr: 7900, expansion: 2400, churn: 1100 },
  { month: "Feb", mrr: 78400, newMrr: 8500, expansion: 3000, churn: 1400 },
  { month: "Mar", mrr: 85200, newMrr: 9600, expansion: 2800, churn: 1600 },
  { month: "Apr", mrr: 91800, newMrr: 9100, expansion: 3400, churn: 1900 },
  { month: "May", mrr: 98700, newMrr: 10200, expansion: 3700, churn: 1800 },
];

export const REVENUE_TOTALS = {
  arr: 98700 * 12,
  ltv: 18400,
  cac: 1180,
  payback: 4.2,
};
