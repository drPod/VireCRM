// Unit tests for load.ts pure helpers — emptyRowCounts() + addRowCounts().
// No DB / no Worker bindings → skip `cloudflare:test`.

import { describe, expect, test } from "vitest";
import {
  addRowCounts,
  emptyRowCounts,
  type RowCounts,
} from "../../scripts/migrate-xlsx/load";

// Canonical table keys + their sub-counter fields per RowCounts type.
// Some tables track inserted/updated, others inserted/reused — preserve that.
const TABLE_FIELDS = {
  customers: ["inserted", "updated"],
  service_addresses: ["inserted", "reused"],
  esis: ["inserted", "updated"],
  contracts: ["inserted", "updated"],
  deals: ["inserted", "updated"],
  commission_statements: ["inserted", "reused"],
  aggregator_payouts: ["inserted", "reused"],
} as const;

// Build a RowCounts with overrides — each table key maps to a partial of its
// sub-counter object. Anything unspecified stays at 0.
function makeCounts(
  overrides: Partial<{
    [K in keyof RowCounts]: Partial<RowCounts[K]>;
  }> = {},
): RowCounts {
  const base = emptyRowCounts();
  for (const k of Object.keys(overrides) as (keyof RowCounts)[]) {
    Object.assign(base[k] as object, overrides[k] ?? {});
  }
  return base;
}

describe("emptyRowCounts()", () => {
  test("returns every expected table key", () => {
    const counts = emptyRowCounts();
    expect(Object.keys(counts).sort()).toEqual(
      Object.keys(TABLE_FIELDS).sort(),
    );
  });

  test.each(Object.entries(TABLE_FIELDS))(
    "%s initialises both sub-counters to 0",
    (table, fields) => {
      const counts = emptyRowCounts();
      const bucket = counts[table as keyof RowCounts] as Record<string, number>;
      expect(Object.keys(bucket).sort()).toEqual([...fields].sort());
      for (const f of fields) expect(bucket[f]).toBe(0);
    },
  );

  test("returns a fresh object each call (no shared reference)", () => {
    const a = emptyRowCounts();
    const b = emptyRowCounts();
    expect(a).not.toBe(b);
    expect(a.customers).not.toBe(b.customers);
  });
});

describe("addRowCounts()", () => {
  test("mutates `a` in place and returns void", () => {
    const a = makeCounts({ customers: { inserted: 1, updated: 2 } });
    const b = makeCounts({ customers: { inserted: 3, updated: 4 } });
    const result = addRowCounts(a, b);
    expect(result).toBeUndefined();
    expect(a.customers).toEqual({ inserted: 4, updated: 6 });
  });

  test("identity: addRowCounts(x, empty) leaves x unchanged", () => {
    const x = makeCounts({
      customers: { inserted: 7, updated: 2 },
      service_addresses: { inserted: 3, reused: 5 },
      esis: { inserted: 1, updated: 9 },
      contracts: { inserted: 4, updated: 0 },
      deals: { inserted: 6, updated: 8 },
      commission_statements: { inserted: 2, reused: 1 },
      aggregator_payouts: { inserted: 5, reused: 4 },
    });
    const snapshot = structuredClone(x);
    addRowCounts(x, emptyRowCounts());
    expect(x).toEqual(snapshot);
  });

  test("zero-base: addRowCounts(empty, x) yields x's values", () => {
    const target = emptyRowCounts();
    const x = makeCounts({
      customers: { inserted: 11, updated: 13 },
      deals: { inserted: 17, updated: 19 },
      aggregator_payouts: { inserted: 23, reused: 29 },
    });
    const snapshot = structuredClone(x);
    addRowCounts(target, x);
    expect(target).toEqual(snapshot);
  });

  test("sum: adds per-key sub-counters across every table", () => {
    const a = makeCounts({
      customers: { inserted: 1, updated: 2 },
      service_addresses: { inserted: 3, reused: 4 },
      esis: { inserted: 5, updated: 6 },
      contracts: { inserted: 7, updated: 8 },
      deals: { inserted: 9, updated: 10 },
      commission_statements: { inserted: 11, reused: 12 },
      aggregator_payouts: { inserted: 13, reused: 14 },
    });
    const b = makeCounts({
      customers: { inserted: 100, updated: 200 },
      service_addresses: { inserted: 300, reused: 400 },
      esis: { inserted: 500, updated: 600 },
      contracts: { inserted: 700, updated: 800 },
      deals: { inserted: 900, updated: 1000 },
      commission_statements: { inserted: 1100, reused: 1200 },
      aggregator_payouts: { inserted: 1300, reused: 1400 },
    });
    addRowCounts(a, b);
    expect(a).toEqual({
      customers: { inserted: 101, updated: 202 },
      service_addresses: { inserted: 303, reused: 404 },
      esis: { inserted: 505, updated: 606 },
      contracts: { inserted: 707, updated: 808 },
      deals: { inserted: 909, updated: 1010 },
      commission_statements: { inserted: 1111, reused: 1212 },
      aggregator_payouts: { inserted: 1313, reused: 1414 },
    });
  });

  test("does not mutate `b`", () => {
    const a = makeCounts({ customers: { inserted: 1 } });
    const b = makeCounts({ customers: { inserted: 2, updated: 3 } });
    const bSnapshot = structuredClone(b);
    addRowCounts(a, b);
    expect(b).toEqual(bSnapshot);
  });

  test("repeated calls accumulate", () => {
    const a = emptyRowCounts();
    const delta = makeCounts({ deals: { inserted: 1, updated: 1 } });
    addRowCounts(a, delta);
    addRowCounts(a, delta);
    addRowCounts(a, delta);
    expect(a.deals).toEqual({ inserted: 3, updated: 3 });
  });
});
