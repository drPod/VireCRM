/**
 * Pure proration estimator extracted from `src/routes/_app.billing.tsx` so it
 * can be unit-tested without spinning up the route's `useState`/`useEffect`
 * scaffolding. Behaviour is intentionally identical to the inline copy that
 * preceded it — see `src/lib/__tests__/billing-proration.test.ts` for the
 * pin-down tests.
 */

export interface ProrationArgs {
  currentPrice: number;
  newPrice: number;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ProrationResult {
  prorationToday: number;
  daysRemaining: number;
  cycleDays: number;
}

/**
 * Estimate prorated charge today when switching from one monthly plan to another
 * partway through a billing cycle. Stripe's actual proration is computed at the
 * moment of the swap; this is a transparent client-side estimate so users aren't
 * surprised by the next invoice.
 *
 * Formula: (newPrice - currentPrice) * (daysRemaining / cycleDays)
 * Returns 0 when downgrading (Stripe issues a credit, no charge today).
 * Returns `null` when the billing period cannot be parsed (missing dates,
 * unparseable, or end <= start).
 */
export function estimateProration(args: ProrationArgs): ProrationResult | null {
  const { currentPrice, newPrice, periodStart, periodEnd } = args;
  if (!periodStart || !periodEnd) return null;
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const cycleDays = Math.max(1, Math.round((end - start) / 86_400_000));
  const daysRemaining = Math.max(0, Math.round((end - now) / 86_400_000));
  const fraction = daysRemaining / cycleDays;
  const delta = newPrice - currentPrice;
  const prorationToday = delta > 0 ? +(delta * fraction).toFixed(2) : 0;
  return { prorationToday, daysRemaining, cycleDays };
}
