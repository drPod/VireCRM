// TCV = Total Contract Value. Two flavors:
//   Gross TCV = Annual Usage (kWh) × Term Years × Agent Mils ÷ 1000
//   Net TCV   = Gross TCV − Lost TCV
//
// Postgres mirrors this via GENERATED ALWAYS AS STORED columns on `contracts`
// (`gross_tcv`, `net_tcv`) so app code never has to compute it at write time.
// This module exists for read-side math (analytics, what-if quotes) and to
// give the DB formula a TS twin we can golden-test in isolation.
//
// Term Years = (endDate − startDate) / 365.25 — matches the Postgres
// expression `(end_date - start_date)::numeric / 365.25`. The 365.25 divisor
// (NOT 365) is what the schema uses; keep them in sync.
//
// Pure math: number-in, number-out. Callers parse `numeric` strings from
// postgres-js and ISO date strings before calling.

export function termYears(startDate: Date, endDate: Date): number {
  const ms = endDate.getTime() - startDate.getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

export function grossTcv({
  annualUsageKwh,
  termYears,
  agentMils,
}: {
  annualUsageKwh: number;
  termYears: number;
  agentMils: number;
}): number {
  return (annualUsageKwh * termYears * agentMils) / 1000;
}

export function netTcv({ grossTcv, lostTcv }: { grossTcv: number; lostTcv: number }): number {
  return grossTcv - lostTcv;
}
