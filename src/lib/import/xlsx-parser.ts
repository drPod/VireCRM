/**
 * XLSX parsing entry point. Uses SheetJS array-of-arrays mode so we can
 * deal with header-shaped first rows, missing cells, and inconsistent
 * widths uniformly. Same heuristic header detection as `parseCSV` — falls
 * back via `raw` field when the name column is missing.
 */

import * as XLSX from "xlsx";
import type { ParseOutcome, RawSheet } from "@/types/import";
import { buildLeadsFromIndices } from "./builder";
import { detectColumnIndices, normalizeHeader } from "./headers";

export function parseXLSX(buffer: ArrayBuffer): ParseOutcome {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch (err) {
    return {
      leads: [],
      issues: [],
      fatal: `Couldn't open the spreadsheet: ${err instanceof Error ? err.message : "unknown error"}.`,
    };
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { leads: [], issues: [], fatal: "Workbook has no sheets." };

  // header:1 forces array-of-arrays output so we can deal with the raw grid
  // even when the file has duplicated, missing, or "header-shaped" first row.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    blankrows: false,
  });
  if (aoa.length === 0) {
    return { leads: [], issues: [], fatal: `Sheet "${sheetName}" is empty.` };
  }

  // Normalize to string[][] and pad to the widest row width.
  const width = aoa.reduce((m, r) => Math.max(m, r.length), 0);
  const grid: string[][] = aoa.map((row) => {
    const out: string[] = [];
    for (let i = 0; i < width; i++) {
      const cell = row[i];
      out.push(cell == null ? "" : String(cell));
    }
    return out;
  });

  const headers = grid[0];
  const dataRows = grid.slice(1);
  const rawSheet: RawSheet = { headers, rows: dataRows, sheetName };

  const normalized = headers.map(normalizeHeader);
  const indices = detectColumnIndices(normalized);

  if (indices.nameIdx === -1) {
    return {
      leads: [],
      issues: [],
      raw: rawSheet,
      fatal: `Missing "Name" column in sheet "${sheetName}". Detected headers: ${normalized.join(", ")}.`,
    };
  }

  return buildLeadsFromIndices({
    rows: dataRows,
    rowOffset: 2,
    ...indices,
    defaultSource: "xlsx_import",
  });
}
