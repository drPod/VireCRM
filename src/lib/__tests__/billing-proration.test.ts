/**
 * Pin-down tests for `estimateProration`, the client-side estimator that
 * previews proration on a mid-cycle plan switch. Mirrors the behaviour the
 * inline implementation in `src/routes/_app.billing.tsx` had before being
 * extracted into `src/lib/billing-proration.ts`.
 *
 * Stripe computes the real proration on the swap — this is a transparent
 * estimate only. Tests use fake timers so `Date.now()` is deterministic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { estimateProration } from "../billing-proration";

/** Fixed billing cycle: 2026-05-01T00:00Z -> 2026-06-01T00:00Z (31 days). */
const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-06-01T00:00:00.000Z";
const CYCLE_DAYS = 31;

/** Move the (already-faked) clock to a fixed UTC instant. */
function freezeNow(iso: string) {
  vi.setSystemTime(new Date(iso));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("estimateProration — same-tier switch", () => {
  it("returns zero proration when newPrice === currentPrice mid-cycle", () => {
    // Half-way through the cycle (day 16 of 31).
    freezeNow("2026-05-16T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 97,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).not.toBeNull();
    expect(result!.prorationToday).toBe(0);
    expect(result!.cycleDays).toBe(CYCLE_DAYS);
    // 31 - 16 = 16 full days remaining when measured from 2026-05-16 00:00Z.
    expect(result!.daysRemaining).toBe(16);
  });
});

describe("estimateProration — upgrade mid-cycle", () => {
  it("charges a prorated amount proportional to days remaining (half-cycle)", () => {
    // Day 16 of 31 → 16 days remaining → fraction ≈ 16/31.
    freezeNow("2026-05-16T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).not.toBeNull();
    // (297 - 97) * (16 / 31) = 200 * 0.51612... ≈ 103.23
    expect(result!.prorationToday).toBeCloseTo(103.23, 2);
    expect(result!.daysRemaining).toBe(16);
    expect(result!.cycleDays).toBe(CYCLE_DAYS);
  });

  it("rounds to two decimal places (matches Stripe display convention)", () => {
    // Day 22 of 31 → 9 days remaining → 200 * 9/31 = 58.0645...
    freezeNow("2026-05-23T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).not.toBeNull();
    // Result must be a 2-decimal number (no float tail).
    expect(result!.prorationToday).toBe(58.06);
  });
});

describe("estimateProration — downgrade mid-cycle", () => {
  it("returns zero proration today on downgrade (Stripe issues credit, no charge)", () => {
    // Day 16 of 31, downgrading from 297 → 97.
    freezeNow("2026-05-16T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 297,
      newPrice: 97,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).not.toBeNull();
    expect(result!.prorationToday).toBe(0);
    expect(result!.daysRemaining).toBe(16);
    expect(result!.cycleDays).toBe(CYCLE_DAYS);
  });
});

describe("estimateProration — edge: same-day switch (cycle just started)", () => {
  it("charges the full delta when zero days have elapsed", () => {
    // Now == periodStart → daysRemaining == cycleDays → fraction == 1.
    freezeNow(PERIOD_START);
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).not.toBeNull();
    expect(result!.daysRemaining).toBe(CYCLE_DAYS);
    expect(result!.cycleDays).toBe(CYCLE_DAYS);
    expect(result!.prorationToday).toBe(200);
  });
});

describe("estimateProration — edge: missing/null period", () => {
  it("returns null when periodStart is null", () => {
    freezeNow("2026-05-16T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: null,
      periodEnd: PERIOD_END,
    });
    expect(result).toBeNull();
  });

  it("returns null when periodEnd is null", () => {
    freezeNow("2026-05-16T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: PERIOD_START,
      periodEnd: null,
    });
    expect(result).toBeNull();
  });

  it("returns null when both dates are null", () => {
    freezeNow("2026-05-16T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: null,
      periodEnd: null,
    });
    expect(result).toBeNull();
  });

  it("returns null when periodStart is an unparseable string", () => {
    freezeNow("2026-05-16T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: "not-a-date",
      periodEnd: PERIOD_END,
    });
    expect(result).toBeNull();
  });

  it("returns null when end <= start (degenerate cycle)", () => {
    freezeNow("2026-05-16T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: PERIOD_END,
      periodEnd: PERIOD_START,
    });
    expect(result).toBeNull();
  });
});

describe("estimateProration — edge: end-of-cycle (1 day left)", () => {
  it("emits a small proration when only one day remains", () => {
    // 2026-05-31T00:00Z → exactly 1 day before periodEnd.
    freezeNow("2026-05-31T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).not.toBeNull();
    expect(result!.daysRemaining).toBe(1);
    expect(result!.cycleDays).toBe(CYCLE_DAYS);
    // (297 - 97) * (1 / 31) = 6.4516... → 6.45
    expect(result!.prorationToday).toBeCloseTo(6.45, 2);
  });

  it("returns zero days remaining and zero charge at the exact period end", () => {
    freezeNow(PERIOD_END);
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).not.toBeNull();
    expect(result!.daysRemaining).toBe(0);
    // Fraction == 0 → no charge today even on upgrade.
    expect(result!.prorationToday).toBe(0);
  });

  it("clamps daysRemaining at zero when now is past periodEnd", () => {
    // Cycle has lapsed by a day.
    freezeNow("2026-06-02T00:00:00.000Z");
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    expect(result).not.toBeNull();
    expect(result!.daysRemaining).toBe(0);
    expect(result!.prorationToday).toBe(0);
  });
});

describe("estimateProration — cycle length normalization", () => {
  it("clamps cycleDays to a minimum of 1 even for a sub-day cycle", () => {
    // Half-second cycle — silly but the implementation guards via Math.max(1, ...).
    const start = "2026-05-01T00:00:00.000Z";
    const end = "2026-05-01T00:00:00.500Z";
    freezeNow(start);
    const result = estimateProration({
      currentPrice: 97,
      newPrice: 297,
      periodStart: start,
      periodEnd: end,
    });
    expect(result).not.toBeNull();
    expect(result!.cycleDays).toBe(1);
  });
});
