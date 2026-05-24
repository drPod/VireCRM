import { describe, expect, it } from "vitest";
import { aggregatorCut } from "../../workers/lib/aggregator";

describe("aggregatorCut", () => {
  it("returns pct of grossTcv", () => {
    expect(aggregatorCut({ grossTcv: 10000, aggregatorCommPct: 25 })).toBe(2500);
    expect(aggregatorCut({ grossTcv: 50000, aggregatorCommPct: 10 })).toBe(5000);
  });

  it("returns 0 when pct is 0", () => {
    expect(aggregatorCut({ grossTcv: 10000, aggregatorCommPct: 0 })).toBe(0);
  });

  it("returns 0 when grossTcv is 0", () => {
    expect(aggregatorCut({ grossTcv: 0, aggregatorCommPct: 25 })).toBe(0);
  });
});
