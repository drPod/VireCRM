/**
 * Money/currency formatting helpers shared across the Revenue & Finance Hub.
 * All amounts are stored in the database as integer cents.
 */

export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatCompactMoney(cents: number | null | undefined, currency = "USD"): string {
  const value = (cents ?? 0) / 100;
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return formatMoney(cents, currency);
}

export function dollarsToCents(input: string | number): number {
  const n = typeof input === "string" ? parseFloat(input) : input;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}
