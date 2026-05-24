// Unit tests for transform.ts — Doc 06 §1 coercion rules.
// Pure function, no Worker bindings → skip `cloudflare:test`.

import { describe, expect, it } from "vitest";
import { transformRow } from "../../scripts/migrate-xlsx/transform";
import type { RawRow } from "../../scripts/migrate-xlsx/types";

// Default fills required cols (B, BG, D, E with valid 17-digit ESI) so each
// test only overrides what it's exercising. headers={} OK — transform only
// reads headers for quarantine.header populating (falls back to label).
function makeRawRow(overrides: Partial<Record<string, string | null>> = {}): RawRow {
  return {
    rowNumber: 2,
    cells: {
      B: "SALE-1",
      BG: "CUST-1",
      D: "Acme Corp",
      E: "10443721234567890",
      ...overrides,
    },
  };
}

const HEADERS: Record<string, string> = {};

describe("transformRow — dash-null coercion", () => {
  it.each([
    ["I", "annualUsageKwh"],
    ["AT", "aqCheck"],
    ["AU", "billingAqKwh"],
    ["AV", "resoldStatus"],
    ["BE", "agentCommsPaid"],
    ["BF", "agentCommsOutstanding"],
  ] as const)("col %s ('-' → null on %s)", (col, field) => {
    const { row } = transformRow(makeRawRow({ [col]: "-" }), HEADERS);
    expect(row).not.toBeNull();
    expect(row![field]).toBeNull();
  });

  it("non-dash-null cols preserve '-' verbatim", () => {
    // T (supplier) + V (lostReason) — not in DASH_NULL_COLS set.
    const { row } = transformRow(makeRawRow({ T: "-", V: "-" }), HEADERS);
    expect(row).not.toBeNull();
    expect(row!.supplier).toBe("-");
    expect(row!.lostReason).toBe("-");
  });

  it("empty string → null everywhere", () => {
    const { row } = transformRow(makeRawRow({ T: "", V: "", AY: "" }), HEADERS);
    expect(row).not.toBeNull();
    expect(row!.supplier).toBeNull();
    expect(row!.lostReason).toBeNull();
    expect(row!.sicCode).toBeNull();
  });
});

describe("transformRow — ESI precision check", () => {
  it("17 digits (Oncor East TX prefix) → passes", () => {
    const { row, quarantine } = transformRow(makeRawRow({ E: "10443721234567890" }), HEADERS);
    expect(row).not.toBeNull();
    expect(row!.esiId).toBe("10443721234567890");
    expect(quarantine).toHaveLength(0);
  });

  it("22 digits → passes", () => {
    const { row, quarantine } = transformRow(makeRawRow({ E: "1044372123456789012345" }), HEADERS);
    expect(row).not.toBeNull();
    expect(row!.esiId).toBe("1044372123456789012345");
    expect(quarantine).toHaveLength(0);
  });

  it("scientific notation (precision-lossed) → quarantined", () => {
    const { row, quarantine } = transformRow(makeRawRow({ E: "1.04437e+16" }), HEADERS);
    expect(row).toBeNull();
    expect(quarantine).toHaveLength(1);
    expect(quarantine[0].column).toBe("E");
    expect(quarantine[0].severity).toBe("error");
  });

  it("short digit-only ESI → passes (legacy meter IDs allowed)", () => {
    // ESI_ID_FORMAT loosened to /^\d+$/ in 2021a27b: real xlsx mixes legacy
    // short meter IDs (10-16 digits) and 23-digit Centerpoint variants with
    // canonical 17-22 digit Oncor IDs. Only non-digit chars indicate
    // precision loss / pollution.
    const { row, quarantine } = transformRow(makeRawRow({ E: "123" }), HEADERS);
    expect(row).not.toBeNull();
    expect(row!.esiId).toBe("123");
    expect(quarantine).toHaveLength(0);
  });

  it("backtick-wrapped ESI → stripped + passes", () => {
    // Source xlsx wraps ESI cells as `<digits>` to force text-format display.
    const { row, quarantine } = transformRow(
      makeRawRow({ E: "`10443721234567890`" }),
      HEADERS,
    );
    expect(row).not.toBeNull();
    expect(row!.esiId).toBe("10443721234567890");
    expect(quarantine).toHaveLength(0);
  });
});

describe("transformRow — required-field skip", () => {
  it.each([
    ["B", "Sale Id"],
    ["BG", "Customer Id"],
    ["D", "Customer Name"],
    ["E", "Meter Number / ESI ID"],
  ])("missing col %s (%s) → row null + error quarantine", (col, label) => {
    const { row, quarantine } = transformRow(makeRawRow({ [col]: null }), HEADERS);
    expect(row).toBeNull();
    // Quarantine MUST name the missing field — sibling missing-fields share row.
    const match = quarantine.find((q) => q.column === col);
    expect(match).toBeDefined();
    expect(match!.severity).toBe("error");
    expect(match!.reason).toContain(label);
  });
});

describe("transformRow — Supply Type quarantine (col F)", () => {
  it.each(["Non-HH", "Gas", "Electricity"])("%s preserved verbatim, no quarantine", (val) => {
    const { row, quarantine } = transformRow(makeRawRow({ F: val }), HEADERS);
    expect(row).not.toBeNull();
    expect(row!.supplyType).toBe(val);
    expect(quarantine).toHaveLength(0);
  });

  it.each(["Solar", "random free text"])(
    "%s → row kept, supplyType null, warn quarantine",
    (val) => {
      const { row, quarantine } = transformRow(makeRawRow({ F: val }), HEADERS);
      expect(row).not.toBeNull();
      expect(row!.supplyType).toBeNull();
      expect(quarantine).toHaveLength(1);
      expect(quarantine[0].column).toBe("F");
      expect(quarantine[0].severity).toBe("warn");
    },
  );
});

describe("transformRow — City/State swap (cols CC/CD)", () => {
  it("CC='TX' CD='Houston' → swap + warn", () => {
    const { row, quarantine } = transformRow(makeRawRow({ CC: "TX", CD: "Houston" }), HEADERS);
    expect(row).not.toBeNull();
    expect(row!.city).toBe("Houston");
    expect(row!.state).toBe("TX");
    const warn = quarantine.find((q) => q.column === "CC/CD");
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe("warn");
    // rawValue captures pre-swap originals — debug aid for downstream fix.
    expect(warn!.rawValue).toBe('city="TX" state="Houston"');
  });

  it("CC='Houston' CD='TX' → no swap, no quarantine", () => {
    const { row, quarantine } = transformRow(makeRawRow({ CC: "Houston", CD: "TX" }), HEADERS);
    expect(row).not.toBeNull();
    expect(row!.city).toBe("Houston");
    expect(row!.state).toBe("TX");
    expect(quarantine.find((q) => q.column === "CC/CD")).toBeUndefined();
  });
});

describe("transformRow — Sale Type coalesce (AS/BM)", () => {
  it("AS='Acq', BM=null → 'Acq', no quarantine", () => {
    const { row, quarantine } = transformRow(makeRawRow({ AS: "Acq" }), HEADERS);
    expect(row!.saleType).toBe("Acq");
    expect(quarantine.find((q) => q.column === "AS/BM")).toBeUndefined();
  });

  it("AS=null, BM='Ren' → 'Ren', no quarantine", () => {
    const { row, quarantine } = transformRow(makeRawRow({ BM: "Ren" }), HEADERS);
    expect(row!.saleType).toBe("Ren");
    expect(quarantine.find((q) => q.column === "AS/BM")).toBeUndefined();
  });

  it("AS='Acq', BM='Acq' → 'Acq', no quarantine", () => {
    const { row, quarantine } = transformRow(makeRawRow({ AS: "Acq", BM: "Acq" }), HEADERS);
    expect(row!.saleType).toBe("Acq");
    expect(quarantine.find((q) => q.column === "AS/BM")).toBeUndefined();
  });

  it("AS='Acq', BM='Ren' (disagree) → prefer AS + warn", () => {
    const { row, quarantine } = transformRow(makeRawRow({ AS: "Acq", BM: "Ren" }), HEADERS);
    expect(row!.saleType).toBe("Acq");
    const warn = quarantine.find((q) => q.column === "AS/BM");
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe("warn");
  });
});

describe("transformRow — Resold canonicalization (col AV)", () => {
  it("'Same Month' → 'same_month'", () => {
    const { row } = transformRow(makeRawRow({ AV: "Same Month" }), HEADERS);
    expect(row!.resoldStatus).toBe("same_month");
  });

  it("'Future Month' → 'future_month'", () => {
    const { row } = transformRow(makeRawRow({ AV: "Future Month" }), HEADERS);
    expect(row!.resoldStatus).toBe("future_month");
  });

  it("'other text' → preserved verbatim", () => {
    const { row } = transformRow(makeRawRow({ AV: "other text" }), HEADERS);
    expect(row!.resoldStatus).toBe("other text");
  });

  it("'-' → null (AV is dash-null col)", () => {
    const { row } = transformRow(makeRawRow({ AV: "-" }), HEADERS);
    expect(row!.resoldStatus).toBeNull();
  });
});

describe("transformRow — pipeline derivation 2×2×2 matrix", () => {
  // (saleStatus ∈ {"Lost","Approved"}) × (isLive Q ∈ {"TRUE",null}) × (contractEnded AH ∈ {"TRUE",null})
  // Rule: Lost → "lost"; else contractEnded → "expired"; else isLive → "active"; else "pending".
  const cases: Array<[string, string | null, string | null, string]> = [
    ["Lost", "TRUE", "TRUE", "lost"],
    ["Lost", "TRUE", null, "lost"],
    ["Lost", null, "TRUE", "lost"],
    ["Lost", null, null, "lost"],
    ["Approved", "TRUE", "TRUE", "expired"],
    ["Approved", null, "TRUE", "expired"],
    ["Approved", "TRUE", null, "active"],
    ["Approved", null, null, "pending"],
  ];

  it.each(cases)("saleStatus=%s Q=%s AH=%s → %s", (saleStatus, q, ah, expected) => {
    const { row } = transformRow(makeRawRow({ R: saleStatus, Q: q, AH: ah }), HEADERS);
    expect(row!.pipelineStatus).toBe(expected);
  });
});

describe("transformRow — isLive boolean OR (Q || AM)", () => {
  it("Q='TRUE' AM=null → true", () => {
    const { row } = transformRow(makeRawRow({ Q: "TRUE" }), HEADERS);
    expect(row!.isLive).toBe(true);
  });

  it("Q=null AM='YES' → true", () => {
    const { row } = transformRow(makeRawRow({ AM: "YES" }), HEADERS);
    expect(row!.isLive).toBe(true);
  });

  it("Q=null AM=null → false", () => {
    const { row } = transformRow(makeRawRow({}), HEADERS);
    expect(row!.isLive).toBe(false);
  });

  // boolFrom is internal — probe indirectly via Q column.
  it.each(["TRUE", "true", "YES", "yes", "Y", "1"])("boolFrom('%s') → true", (val) => {
    const { row } = transformRow(makeRawRow({ Q: val }), HEADERS);
    expect(row!.isLive).toBe(true);
  });

  it.each(["FALSE", "NO", "0"])("boolFrom('%s') → false", (val) => {
    const { row } = transformRow(makeRawRow({ Q: val }), HEADERS);
    expect(row!.isLive).toBe(false);
  });

  it("boolFrom('') → false", () => {
    const { row } = transformRow(makeRawRow({ Q: "" }), HEADERS);
    expect(row!.isLive).toBe(false);
  });

  it("boolFrom(null) → false", () => {
    const { row } = transformRow(makeRawRow({ Q: null }), HEADERS);
    expect(row!.isLive).toBe(false);
  });
});

describe("transformRow — date coercion (dateOnly)", () => {
  // Applied to J (startDate), K (endDate), C (saleDate), U (lostDate).
  it("ISO datetime → YYYY-MM-DD", () => {
    const { row } = transformRow(
      makeRawRow({
        J: "2025-03-15T00:00:00Z",
        K: "2025-03-15T00:00:00Z",
        C: "2025-03-15T00:00:00Z",
        U: "2025-03-15T00:00:00Z",
      }),
      HEADERS,
    );
    expect(row!.startDate).toBe("2025-03-15");
    expect(row!.endDate).toBe("2025-03-15");
    expect(row!.saleDate).toBe("2025-03-15");
    expect(row!.lostDate).toBe("2025-03-15");
  });

  it("YYYY-MM-DD → YYYY-MM-DD", () => {
    const { row } = transformRow(makeRawRow({ J: "2025-03-15" }), HEADERS);
    expect(row!.startDate).toBe("2025-03-15");
  });

  it("malformed 'MM/DD/YYYY' → null + warn quarantine", () => {
    // dateOnly hardened in 2021a27b: bulk INSERT can't tolerate one bad date
    // aborting the whole VALUES chunk. Non-ISO inputs coerce to null + warn.
    const { row, quarantine } = transformRow(makeRawRow({ J: "03/15/2025" }), HEADERS);
    expect(row!.startDate).toBeNull();
    const warn = quarantine.find((q) => q.column === "J");
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe("warn");
  });

  it("null → null", () => {
    const { row } = transformRow(makeRawRow({ J: null }), HEADERS);
    expect(row!.startDate).toBeNull();
  });
});

describe("transformRow — round-trip principle (col R saleStatus)", () => {
  // Transform layer MUST NOT collapse to smaller enum; verbatim preserved.
  it.each(["Approved", "Pending", "Lost", "Cancelled", "Custom", "Anything"])(
    "%s preserved verbatim",
    (val) => {
      const { row } = transformRow(makeRawRow({ R: val }), HEADERS);
      expect(row!.saleStatus).toBe(val);
    },
  );
});
