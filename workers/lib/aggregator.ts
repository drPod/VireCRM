// Aggregator = upstream broker taking a % cut of gross TCV when the in-house
// agent is acting as a sub-broker. xlsx cols `Agg Name` + `Agg Comm %`.
// Tracked in AggregatorPayouts table.
//
// Pure math: number-in, number-out. Caller parses numeric strings from DB.

export function aggregatorCut({
  grossTcv,
  aggregatorCommPct,
}: {
  grossTcv: number;
  aggregatorCommPct: number;
}): number {
  return (grossTcv * aggregatorCommPct) / 100;
}
