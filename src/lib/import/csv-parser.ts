/**
 * CSV parsing entry point. Splits on newlines, parses quote-aware columns,
 * and hands the resulting grid to `buildLeadsFromIndices`. When the
 * heuristic can't find a name column, returns the raw sheet so the caller
 * can fall back to AI column mapping.
 */

import type { ParseOutcome, RawSheet } from "@/types/import";
import { buildLeadsFromIndices } from "./builder";
import { detectColumnIndices, normalizeHeader } from "./headers";

export function parseCSV(text: string): ParseOutcome {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return {
      leads: [],
      issues: [],
      fatal: "File looks empty — need a header row plus at least one data row.",
    };
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^['"]|['"]$/g, ""));
  const dataRows = lines.slice(1).map((l) => parseCSVLine(l));
  const rawSheet: RawSheet = { headers, rows: dataRows, sheetName: "csv" };

  const indices = detectColumnIndices(headers.map(normalizeHeader));

  if (indices.nameIdx === -1) {
    // Hand off to the AI fallback — caller decides what to do.
    return {
      leads: [],
      issues: [],
      raw: rawSheet,
      fatal: `Missing "Name" column. Detected headers: ${headers.join(", ") || "(none)"}.`,
    };
  }

  return buildLeadsFromIndices({
    rows: dataRows,
    rowOffset: 2, // header is row 1, data starts row 2
    ...indices,
    defaultSource: "csv_import",
  });
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
