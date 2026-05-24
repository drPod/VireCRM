import { describe, expect, it } from "vitest";
import { aqVariance, isAqDispute } from "../../workers/lib/aq";

describe("aqVariance", () => {
  it("returns positive ratio when billing exceeds estimate", () => {
    expect(aqVariance({ eac: 100_000, billingAq: 110_000 })).toBeCloseTo(0.1);
  });

  it("returns negative ratio when billing falls short", () => {
    expect(aqVariance({ eac: 100_000, billingAq: 90_000 })).toBeCloseTo(-0.1);
  });

  it("returns 0 when billing matches estimate", () => {
    expect(aqVariance({ eac: 100_000, billingAq: 100_000 })).toBe(0);
  });

  it("returns 0 when both eac and billing are 0", () => {
    expect(aqVariance({ eac: 0, billingAq: 0 })).toBe(0);
  });

  it("returns +Infinity when eac is 0 but billing is non-zero", () => {
    expect(aqVariance({ eac: 0, billingAq: 50_000 })).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("isAqDispute", () => {
  it("flags when |variance| >= threshold", () => {
    expect(isAqDispute(0.1, 0.1)).toBe(true);
    expect(isAqDispute(0.15, 0.1)).toBe(true);
    expect(isAqDispute(-0.2, 0.1)).toBe(true);
  });

  it("does not flag when |variance| < threshold", () => {
    expect(isAqDispute(0.05, 0.1)).toBe(false);
    expect(isAqDispute(-0.09, 0.1)).toBe(false);
    expect(isAqDispute(0, 0.1)).toBe(false);
  });

  it("treats threshold as required (no implicit default)", () => {
    // Threshold is caller-supplied; magic defaults rejected by design.
    expect(isAqDispute(0.5, 0.25)).toBe(true);
    expect(isAqDispute(0.5, 0.75)).toBe(false);
  });
});
