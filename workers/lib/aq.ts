// AQ = Annual Quantity (kWh). Billing AQ = actual billed annual volume.
// Commission paid against Billing AQ, not EAC (Estimated Annual Consumption).
// Variance between the two = #1 source of reconciliation disputes.
//
// Pure math: number-in, number-out. Caller parses numeric strings from DB.

export function aqVariance({ eac, billingAq }: { eac: number; billingAq: number }): number {
  if (eac === 0) {
    return billingAq === 0 ? 0 : Number.POSITIVE_INFINITY;
  }
  return (billingAq - eac) / eac;
}

export function isAqDispute(variance: number, threshold: number): boolean {
  return Math.abs(variance) >= threshold;
}
