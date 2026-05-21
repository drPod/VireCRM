/**
 * Shared types for the lead-import pipeline. Pulled out of
 * `ImportLeadsDialog.tsx` so the parsing logic in `src/lib/import/` can be
 * unit-tested without dragging React along.
 */

export interface ParsedLead {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: string;
  score?: number;
  notes?: string;
  source?: string;
  /** Contact's job title at the customer org. */
  title?: string;
  /** Agent-set deal label (e.g. "Acme Q3 Renewal"). */
  deal_name?: string;
  /** Physical service address of metered location. */
  service_address?: string;
  /** Texas ESID(s). Comma-separated for multi-meter customers (v1). */
  esi_id?: string;
  /** Annual electricity usage in kWh (energy-broker workflow). */
  annual_kwh?: number | null;
  /** Contract start date as ISO YYYY-MM-DD. */
  contract_start_date?: string | null;
  /** Contract end date as ISO YYYY-MM-DD. */
  contract_end_date?: string | null;
  /** Current energy supplier name. */
  current_supplier?: string | null;
  /** Supplier wholesale rate, $/kWh. */
  cost_per_kwh?: number | null;
  /** Broker commission rate in mils ($0.001/kWh). */
  agent_mils?: number | null;
}

/** Per-row warning/error captured during parsing — surfaced to the user. */
export interface ParseIssue {
  row: number; // 1-indexed, matches what the user sees in their spreadsheet
  message: string;
}

export interface ParseOutcome {
  leads: ParsedLead[];
  issues: ParseIssue[];
  /** Hard error that prevented parsing the file at all (vs. per-row issues). */
  fatal?: string;
  /**
   * Raw representation handed back when heuristic header detection fails.
   * The caller can pass this to the AI mapper and re-emit leads.
   */
  raw?: RawSheet;
}

/** Sheet contents in a header-agnostic form, suitable for AI column mapping. */
export interface RawSheet {
  /** Raw header strings as they appeared in row 1. May actually be data. */
  headers: string[];
  /** Each row is the same length as headers; missing cells are "". */
  rows: string[][];
  /** Sheet name (xlsx) or "csv" — used in fallback messaging. */
  sheetName: string;
}

export interface IndexMap {
  rows: string[][];
  /** What real spreadsheet row number does rows[0] correspond to? (1-indexed for the user) */
  rowOffset: number;
  nameIdx: number;
  emailIdx: number;
  phoneIdx: number;
  companyIdx: number;
  statusIdx: number;
  scoreIdx: number;
  notesIdx: number;
  sourceIdx: number;
  titleIdx: number;
  dealNameIdx: number;
  addressIdx: number;
  esiIdx: number;
  annualKwhIdx: number;
  contractStartIdx: number;
  contractEndIdx: number;
  supplierIdx: number;
  costPerKwhIdx: number;
  milsIdx: number;
  defaultSource: string;
}
