/**
 * Loose numeric/date parsers for the energy-broker columns. All return
 * `null` for unparseable input — never throw — so the row-builder can
 * decide whether to flag a `ParseIssue` or silently drop the value.
 */

/** Parse "12,345", "12345 kWh", "12.5k" loosely into a positive integer kWh. */
export function parseAnnualKwh(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  // Strip spaces, commas, and any non-numeric suffix like "kwh".
  const numericPart = s.replace(/,/g, "").replace(/\s+/g, "").replace(/kwh$/i, "");
  // "12.5k" → 12500
  const kMatch = numericPart.match(/^(\d+(?:\.\d+)?)k$/);
  let n: number;
  if (kMatch) {
    n = Math.round(Number(kMatch[1]) * 1000);
  } else {
    n = Math.round(Number(numericPart));
  }
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Parse a $/kWh rate. Accepts "$0.085", "0.085", "8.5¢", "85", "85.5".
 * Bare ints ≥1 are treated as cents (Crystal's spreadsheet style: "8.5" =
 * 8.5¢/kWh = $0.085); anything <1 is taken as dollars verbatim. Returns
 * dollars-per-kWh as numeric, or null if unparseable.
 */
export function parseCostPerKwh(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const cleaned = s
    .replace(/[$,\s]/g, "")
    .replace(/¢$/, "")
    .replace(/\/kwh$/, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  // Heuristic: >= 1 = cents/kWh (e.g. "8.5"), divide by 100. Else dollars.
  const dollars = n >= 1 ? n / 100 : n;
  // numeric(8,5) caps at ~999.99999 — well above any real rate.
  return Math.round(dollars * 100000) / 100000;
}

/**
 * Parse agent commission in mils ($0.001/kWh). Accepts "3", "3.0", "3 mils",
 * "$0.003" (interpreted as 3 mils). Returns mils-per-kWh as numeric.
 */
export function parseMils(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const cleaned = s.replace(/[$,\s]/g, "").replace(/mils?$/, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  // Bare decimals like "0.003" → 3 mils. Whole numbers like "3" → 3 mils.
  const mils = n > 0 && n < 1 ? n * 1000 : n;
  // numeric(6,3) caps at 999.999.
  return Math.round(mils * 1000) / 1000;
}

/**
 * Parse a contract end date cell into ISO YYYY-MM-DD. Accepts:
 * - YYYY-MM-DD / YYYY/MM/DD
 * - DD/MM/YYYY or DD-MM-YYYY (UK convention — common in energy contracts)
 * - Excel serial numbers (days since 1899-12-30)
 * - Anything Date.parse() understands as a last resort.
 * Returns null when the cell is blank or unparseable.
 */
export function parseContractDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Excel serial (e.g. 45123) — pure integer 1000–80000 range.
  if (/^\d{4,5}$/.test(s)) {
    const serial = parseInt(s, 10);
    if (serial >= 1000 && serial <= 80000) {
      // Excel epoch is 1899-12-30 (accounts for the 1900 leap-year bug).
      const ms = (serial - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (UK first — most common for energy data).
  const ukMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (ukMatch) {
    const [, d, m] = ukMatch;
    let y = ukMatch[3];
    if (y.length === 2) y = (parseInt(y, 10) > 50 ? "19" : "20") + y;
    const day = parseInt(d, 10);
    const mon = parseInt(m, 10);
    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  // Last resort — let JS try.
  const fallback = new Date(s);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }
  return null;
}
