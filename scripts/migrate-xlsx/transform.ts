// RawRow → TransformedRow with all coercion rules from Doc 06 §1:
// - "-" → NULL for cols I, AT, AU, AV, BE, BF (preserved 0s for N, Y, Z, AA)
// - Supply Type col F: 7 polluted free-text values quarantined → NULL (row kept)
// - Sale Status col R: preserve verbatim, do NOT coalesce
// - Resold Status col AV: "Same Month" → "same_month", "Future Month" → "future_month"
// - City/State swap (cols CC/CD): if city matches /^[A-Z]{2}$/, swap with state + WARN
// - Sale Type cols AS/BM: coalesce; mismatch → WARN, prefer AS
// - Pipeline status derived from Sale Status (R), Contract Ended (AH), Is Live (Q/AM)
// - Dates → ISO 8601 (YYYY-MM-DD)

import type { QuarantineRecord, RawRow, TransformedRow } from "./types";

const US_STATE_2 = /^[A-Z]{2}$/;
const ALLOWED_SUPPLY_TYPES = new Set(["Non-HH", "Gas", "Electricity"]);
const DASH_NULL_COLS = new Set(["I", "AT", "AU", "AV", "BE", "BF"]);
// xlsx col E ("Meter Number") is colloquial — true 17-22 digit Oncor ESI IDs
// mix with legacy short meter IDs (10-16 digits) and longer Centerpoint-style
// variants (23 digits). Per round-trip principle accept any digit-only value;
// only quarantine if non-digit chars appear (real precision loss surfaces as
// scientific notation or a decimal point).
const ESI_ID_FORMAT = /^\d+$/;

export interface TransformResult {
  row: TransformedRow | null; // null → row should be skipped
  quarantine: QuarantineRecord[];
}

export function transformRow(
  raw: RawRow,
  headers: Record<string, string>,
): TransformResult {
  const quarantine: QuarantineRecord[] = [];
  const r = raw.rowNumber;

  // Read with dash-null coercion applied to specific cols.
  const get = (col: string): string | null => {
    let v = raw.cells[col];
    if (v == null) return null;
    v = v.trim();
    if (v === "") return null;
    if (DASH_NULL_COLS.has(col) && v === "-") return null;
    return v;
  };

  // Numeric coercion for PG `numeric` columns. xlsx mixes freeform text ("No
  // credit info", "TBD", "—") into ostensibly numeric cells; per-row loader
  // surfaced these as individual row failures, but bulk INSERT aborts the
  // whole VALUES statement on the first cast failure. Strip presentation
  // chars ($, %, ,), accept plain decimals + scientific notation, quarantine
  // anything else as a warn (row survives, column nulled).
  const NUMERIC_RX = /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
  const numericFrom = (
    col: string,
    label: string,
    opts?: { stripPct?: boolean },
  ): string | null => {
    const raw = get(col);
    if (raw == null) return null;
    let v = raw.replace(/[,\s$]/g, "");
    if (opts?.stripPct) v = v.replace(/%$/, "");
    if (!NUMERIC_RX.test(v)) {
      quarantine.push({
        rowNumber: r,
        column: col,
        header: headers[col] ?? label,
        rawValue: raw,
        reason: `${label} "${raw}" not numeric — coerced to NULL`,
        severity: "warn",
      });
      return null;
    }
    return v;
  };

  const requireField = (col: string, label: string): string | null => {
    const v = get(col);
    if (!v) {
      quarantine.push({
        rowNumber: r,
        column: col,
        header: headers[col] ?? label,
        rawValue: raw.cells[col] ?? "",
        reason: `${label} missing — row skipped`,
        severity: "error",
      });
      return null;
    }
    return v;
  };

  // Required identifiers — row skipped on any missing.
  const externalSaleId = requireField("B", "Sale Id");
  const externalCustomerId = requireField("BG", "Customer Id");
  const customerName = requireField("D", "Customer Name");
  const esiIdRaw = requireField("E", "Meter Number / ESI ID");
  if (!externalSaleId || !externalCustomerId || !customerName || !esiIdRaw) {
    return { row: null, quarantine };
  }

  // Source xlsx wraps every ESI cell as `` `<digits>` `` — backticks force
  // text-format display in Excel. Strip them before validation; backticks are
  // never valid ESI chars, only presentation cruft from the export.
  const esiId = esiIdRaw.replace(/^`+|`+$/g, "");

  // ESI ID precision check. xlsx cells formatted as Number lose precision at
  // 16+ digits in JS (`9.007e15` ceiling) — silent corruption. If col E is
  // text-formatted in the source, it round-trips fine. If not, extract.ts
  // already saw a rounded Number and we can't recover the original digits;
  // best we can do is detect + quarantine the row before it lands in DB as
  // wrong-but-plausible data.
  if (!ESI_ID_FORMAT.test(esiId)) {
    quarantine.push({
      rowNumber: r,
      column: "E",
      header: headers["E"] ?? "Meter Number / ESI ID",
      rawValue: esiId,
      reason: `ESI ID "${esiId}" contains non-digit chars — likely xlsx numeric-format precision loss or polluted cell — row skipped`,
      severity: "error",
    });
    return { row: null, quarantine };
  }

  // Supply Type quarantine — keep row, NULL out the col.
  let supplyType = get("F");
  if (supplyType && !ALLOWED_SUPPLY_TYPES.has(supplyType)) {
    quarantine.push({
      rowNumber: r,
      column: "F",
      header: headers["F"] ?? "Supply Type",
      rawValue: supplyType,
      reason: `polluted free-text supply type — coerced to NULL`,
      severity: "warn",
    });
    supplyType = null;
  }

  // Sale Type coalesce (AS vs BM).
  const saleTypeAS = get("AS");
  const saleTypeBM = get("BM");
  let saleType: string | null = saleTypeAS ?? saleTypeBM;
  if (saleTypeAS && saleTypeBM && saleTypeAS !== saleTypeBM) {
    quarantine.push({
      rowNumber: r,
      column: "AS/BM",
      header: "Sale Type vs Acq/Ren",
      rawValue: `AS="${saleTypeAS}" BM="${saleTypeBM}"`,
      reason: `Sale Type and Acq/Ren disagree — kept AS`,
      severity: "warn",
    });
  }

  // Resold Status canonicalization.
  let resoldStatus = get("AV");
  if (resoldStatus === "Same Month") resoldStatus = "same_month";
  else if (resoldStatus === "Future Month") resoldStatus = "future_month";

  // City/State swap — run BEFORE address normalization so equal-after-swap
  // addresses hash to the same dedup key.
  let city = get("CC");
  let state = get("CD");
  if (city && US_STATE_2.test(city.toUpperCase())) {
    const swapped = state;
    state = city.toUpperCase();
    city = swapped;
    quarantine.push({
      rowNumber: r,
      column: "CC/CD",
      header: "city/state",
      rawValue: `city="${raw.cells["CC"] ?? ""}" state="${raw.cells["CD"] ?? ""}"`,
      reason: `2-letter state code in city — swapped`,
      severity: "warn",
    });
  }

  // Zip coalesce (BP primary, CE fallback).
  const zip = get("BP") ?? get("CE");

  // Is Live: Q (Is Contract Live?) || AM (Is Gone Live?)
  const isLive = boolFrom(get("Q")) || boolFrom(get("AM"));
  const contractEnded = boolFrom(get("AH"));

  // Pipeline status derivation. R holds verbatim (6-value) sale status; we
  // collapse to the 4-value enum here without losing the original on deals.
  const saleStatus = get("R");
  let pipelineStatus: TransformedRow["pipelineStatus"];
  if (saleStatus === "Lost") pipelineStatus = "lost";
  else if (contractEnded) pipelineStatus = "expired";
  else if (isLive) pipelineStatus = "active";
  else pipelineStatus = "pending";

  // Dates → YYYY-MM-DD. Reject anything that doesn't look like an ISO date
  // prefix; bulk INSERT can't tolerate one bad cell aborting the whole chunk
  // (xlsx has freeform notes like "Bryan signed renewal direct" in date cols).
  const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
  const dateOnly = (
    v: string | null,
    col?: string,
    label?: string,
  ): string | null => {
    if (!v) return null;
    if (ISO_DATE_PREFIX.test(v)) return v.slice(0, 10);
    if (col) {
      quarantine.push({
        rowNumber: r,
        column: col,
        header: headers[col] ?? label ?? col,
        rawValue: v,
        reason: `${label ?? col} "${v}" not an ISO date — coerced to NULL`,
        severity: "warn",
      });
    }
    return null;
  };

  const row: TransformedRow = {
    rowNumber: r,
    externalSaleId,
    externalCustomerId,
    customerName,
    esiId,

    primaryContactName: get("BU"),
    primaryTitle: get("BV"),
    primaryEmail: get("BW"),
    primaryPhone: get("BX"),
    sicCode: get("AY"),
    businessType: get("AZ"),
    category: get("AX"),
    region: get("BO"),
    customerCounty: get("BQ"),
    creditScore: numericFrom("AL", "credit score"),
    annualRevenue: numericFrom("AK", "annual revenue"),

    streetNo: get("CB"),
    streetName: get("CA"),
    addressLine1: get("BY"),
    addressLine2: get("BZ"),
    city,
    state,
    zip,
    addressCounty: get("BQ"),
    govtArea: get("BR"),

    physicalMeterSerial: get("BH"),
    eacKwh: numericFrom("H", "EAC (kWh)"),
    billingAqKwh: numericFrom("AU", "Billing AQ (kWh)"),
    annualUsageKwh: numericFrom("I", "annual usage (kWh)"),

    supplyType,
    agentMils: numericFrom("G", "agent mils"),
    startDate: dateOnly(get("J"), "J", "start date"),
    endDate: dateOnly(get("K"), "K", "end date"),
    currency: get("L") ?? "USD",
    fxRate: numericFrom("BL", "FX rate") ?? "1.0",
    grossTcvXlsx: numericFrom("M", "gross TCV"),
    netTcvXlsx: numericFrom("P", "net TCV"),
    lostTcv: numericFrom("N", "lost TCV"),
    lostPartial: boolFrom(get("O")),
    isLive,
    supplier: get("T"),
    lostDate: dateOnly(get("U"), "U", "lost date"),
    lostReason: get("V"),
    lostBeforeStart: boolFrom(get("W")),
    aqLoss: numericFrom("Y", "AQ loss"),
    aqGain: numericFrom("Z", "AQ gain"),
    lostAfterLive: boolFrom(get("AN")),
    completedPostLive: boolFrom(get("AO")),
    saleType,
    aqCheck: numericFrom("AT", "AQ check"),
    resoldStatus,
    nomination: get("AW"),
    paymentTerm: get("BA"),
    isResold: boolFrom(get("BS")),
    resoldSaleId: get("BT"),
    contractEnded,
    pipelineStatus,

    saleDate: dateOnly(get("C"), "C", "sale date"),
    saleStatus, // verbatim — round-trip principle
    objectionStatus: get("S"),
    objectionType: get("AI"),
    sourceOfLead: get("BK"),

    primaryAgentName: get("AQ"),
    secondaryAgentName: get("AR"),

    receivedAmount: numericFrom("BB", "received amount"),
    outstandingAmount: numericFrom("BC", "outstanding amount"),
    netOutstanding: numericFrom("BD", "net outstanding"),
    agentCommsPaid: numericFrom("BE", "agent comms paid"),
    agentCommsOutstanding: numericFrom("BF", "agent comms outstanding"),

    aggregatorName: get("BI"),
    aggregatorCommPct: numericFrom("BJ", "aggregator comm %", { stripPct: true }),
  };

  return { row, quarantine };
}

function boolFrom(v: string | null): boolean {
  if (!v) return false;
  const u = v.trim().toUpperCase();
  return u === "TRUE" || u === "YES" || u === "Y" || u === "1";
}
