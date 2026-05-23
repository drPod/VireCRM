// Shared types for the Phase 2 one-shot xlsx → Postgres migration.
// RawRow is what `extract.ts` emits (pre-string-coerced cells keyed by col letter).
// TransformedRow is what `transform.ts` emits (typed, post-coercion, ready for load.ts).
// QuarantineRecord is the structured log entry written to JSONL + stderr.
// Summary is the final stdout payload the entry script prints.

export interface RawRow {
  rowNumber: number; // 1-based xlsx row (data starts at row 2)
  cells: Record<string, string | null>; // keys = col letter (A, B, ..., CE)
}

export interface TransformedRow {
  rowNumber: number;

  // Identity (required — row skipped if missing)
  externalSaleId: string; // B
  externalCustomerId: string; // BG
  customerName: string; // D
  esiId: string; // E (xlsx "Meter Number")

  // Customer
  primaryContactName: string | null; // BU
  primaryTitle: string | null; // BV
  primaryEmail: string | null; // BW
  primaryPhone: string | null; // BX
  sicCode: string | null; // AY
  businessType: string | null; // AZ
  category: string | null; // AX
  region: string | null; // BO
  customerCounty: string | null; // BQ (also addr.county)
  creditScore: string | null; // AL
  annualRevenue: string | null; // AK

  // Service address
  streetNo: string | null; // CB
  streetName: string | null; // CA
  addressLine1: string | null; // BY
  addressLine2: string | null; // BZ
  city: string | null; // CC (post-swap)
  state: string | null; // CD (post-swap)
  zip: string | null; // BP/CE (coalesced)
  addressCounty: string | null; // BQ
  govtArea: string | null; // BR

  // ESI
  physicalMeterSerial: string | null; // BH
  eacKwh: string | null; // H
  billingAqKwh: string | null; // AU ("-" → null)
  annualUsageKwh: string | null; // I ("-" → null)

  // Contract
  supplyType: string | null; // F (polluted entries quarantined → null)
  agentMils: string | null; // G ("Unit Uplift")
  startDate: string | null; // J (ISO date)
  endDate: string | null; // K (ISO date)
  currency: string; // L (default "USD")
  fxRate: string; // BL (default "1.0")
  grossTcvXlsx: string | null; // M (DB also computes via generated col)
  netTcvXlsx: string | null; // P (DB also computes via generated col)
  lostTcv: string | null; // N
  lostPartial: boolean; // O
  isLive: boolean; // Q || AM
  supplier: string | null; // T
  lostDate: string | null; // U
  lostReason: string | null; // V
  lostBeforeStart: boolean; // W
  aqLoss: string | null; // Y
  aqGain: string | null; // Z
  lostAfterLive: boolean; // AN
  completedPostLive: boolean; // AO
  saleType: string | null; // AS / BM (coalesced; mismatch warned)
  aqCheck: string | null; // AT
  resoldStatus: string | null; // AV ("-" → null, "Same Month" → "same_month", etc)
  nomination: string | null; // AW
  paymentTerm: string | null; // BA
  isResold: boolean; // BS
  resoldSaleId: string | null; // BT (resolved in pass 2)
  contractEnded: boolean; // AH (drives pipelineStatus)
  pipelineStatus: "pending" | "active" | "expired" | "lost"; // derived

  // Deal
  saleDate: string | null; // C
  saleStatus: string | null; // R (verbatim; not coalesced to 3-value set)
  objectionStatus: string | null; // S
  objectionType: string | null; // AI
  sourceOfLead: string | null; // BK

  // Agents (lazy create by name)
  primaryAgentName: string | null; // AQ
  secondaryAgentName: string | null; // AR

  // Commission statement (skip insert if all fields null)
  receivedAmount: string | null; // BB
  outstandingAmount: string | null; // BC
  netOutstanding: string | null; // BD
  agentCommsPaid: string | null; // BE
  agentCommsOutstanding: string | null; // BF

  // Aggregator payout (skip insert if name null)
  aggregatorName: string | null; // BI
  aggregatorCommPct: string | null; // BJ
}

export type QuarantineSeverity = "warn" | "error";

export interface QuarantineRecord {
  rowNumber: number;
  column: string; // col letter (A..CE) or "row" for whole-row errors
  header: string;
  rawValue: string;
  reason: string;
  severity: QuarantineSeverity;
}

export interface TableCounts {
  inserted: number;
  updated: number;
  reused: number;
}

export interface Summary {
  totalDataRows: number;
  processedRows: number;
  skippedRows: number;
  failedRows: number;
  dryRun: boolean;
  quarantineCount: number;
  quarantinePath: string | null;
  tables: {
    agents: TableCounts;
    customers: TableCounts;
    service_addresses: TableCounts;
    esis: TableCounts;
    contracts: TableCounts;
    deals: TableCounts;
    commission_statements: TableCounts;
    aggregator_payouts: TableCounts;
  };
  resoldLinks: { linked: number; missing: number };
  status: "PASS" | "FAIL";
  failureReason?: string;
}

export type TableName = keyof Summary["tables"];
