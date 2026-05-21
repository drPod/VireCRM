/**
 * Spot-check tests for the loose energy-broker field parsers. These exist
 * mostly to lock in the heuristics agreed with Crystal's spreadsheets:
 * bare ints ≥1 in the cost column = cents/kWh, bare decimals in the mils
 * column = pre-multiplied (already mils), UK-first date parsing.
 */
import { describe, it, expect } from "vitest";
import { parseAnnualKwh, parseContractDate, parseCostPerKwh, parseMils } from "../field-parsers";

describe("parseAnnualKwh", () => {
  it("strips commas and trailing kwh suffix", () => {
    expect(parseAnnualKwh("12,345 kWh")).toBe(12345);
  });
  it("expands the k-suffix shorthand", () => {
    expect(parseAnnualKwh("12.5k")).toBe(12500);
  });
  it("returns null on blank and garbage", () => {
    expect(parseAnnualKwh("")).toBeNull();
    expect(parseAnnualKwh("n/a")).toBeNull();
  });
  it("rejects negatives", () => {
    expect(parseAnnualKwh("-100")).toBeNull();
  });
});

describe("parseCostPerKwh", () => {
  it("treats bare ints ≥1 as cents/kWh", () => {
    // Crystal's style: "8.5" = 8.5¢/kWh = $0.085
    expect(parseCostPerKwh("8.5")).toBe(0.085);
  });
  it("takes bare decimals <1 as dollars verbatim", () => {
    expect(parseCostPerKwh("0.085")).toBe(0.085);
  });
  it("strips $ and /kwh decoration", () => {
    expect(parseCostPerKwh("$0.085/kWh")).toBe(0.085);
  });
});

describe("parseMils", () => {
  it("treats whole numbers as already-in-mils", () => {
    expect(parseMils("3")).toBe(3);
  });
  it("expands bare decimals <1 into mils", () => {
    // "0.003" = $0.003/kWh = 3 mils
    expect(parseMils("0.003")).toBe(3);
  });
  it("strips the 'mils' suffix", () => {
    expect(parseMils("3 mils")).toBe(3);
  });
});

describe("parseContractDate", () => {
  it("parses ISO YYYY-MM-DD verbatim", () => {
    expect(parseContractDate("2026-07-15")).toBe("2026-07-15");
  });
  it("interprets DD/MM/YYYY as UK-style", () => {
    // 15/07/2026 → 2026-07-15 (energy-contract convention)
    expect(parseContractDate("15/07/2026")).toBe("2026-07-15");
  });
  it("decodes Excel serial numbers", () => {
    // 45123 = 2023-07-16 in Excel's 1899-12-30 epoch
    expect(parseContractDate("45123")).toBe("2023-07-16");
  });
  it("returns null on blank input", () => {
    expect(parseContractDate("")).toBeNull();
  });
});
