import { describe, expect, it } from "vitest";
import { formatMils, milsToUsdPerKwh, usdPerKwhToMils } from "../../workers/lib/mils";

describe("milsToUsdPerKwh", () => {
  it("converts whole mils to USD/kWh", () => {
    expect(milsToUsdPerKwh(5)).toBe(0.005);
    expect(milsToUsdPerKwh(1)).toBe(0.001);
    expect(milsToUsdPerKwh(100)).toBe(0.1);
  });

  it("handles zero", () => {
    expect(milsToUsdPerKwh(0)).toBe(0);
  });
});

describe("usdPerKwhToMils", () => {
  it("converts USD/kWh to mils", () => {
    expect(usdPerKwhToMils(0.005)).toBe(5);
    expect(usdPerKwhToMils(0.001)).toBe(1);
  });

  it("round-trips with milsToUsdPerKwh for typical broker values", () => {
    for (const mils of [1, 3, 5, 7, 10, 25, 50]) {
      expect(usdPerKwhToMils(milsToUsdPerKwh(mils))).toBe(mils);
    }
  });
});

describe("formatMils", () => {
  it("pluralises", () => {
    expect(formatMils(1)).toBe("1 mil");
    expect(formatMils(0)).toBe("0 mils");
    expect(formatMils(2)).toBe("2 mils");
    expect(formatMils(5)).toBe("5 mils");
  });
});
