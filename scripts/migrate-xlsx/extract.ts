// ExcelJS-driven extractor. Loads the workbook, walks the first sheet's data
// rows, and yields RawRows keyed by xlsx column letter (A..CE). Cell coercion
// mirrors `scripts/inspect-xlsx.ts` (Date → ISO, formula → result, richText → text).

import { resolve } from "node:path";
import * as ExcelJS from "exceljs";
import type { RawRow } from "./types";

export const DEFAULT_XLSX_PATH = "Copy of NGP MASTER LIST - Copy.xlsx";

export interface ExtractResult {
  headers: Record<string, string>; // col letter → header text
  totalRows: number; // count of data rows (excludes header)
  rows: AsyncIterable<RawRow>;
}

export async function extractXlsx(path: string): Promise<ExtractResult> {
  const absPath = resolve(process.cwd(), path);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(absPath);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error(`No worksheets in ${absPath}`);

  const rowCount = sheet.actualRowCount;
  const colCount = sheet.actualColumnCount;

  const headers: Record<string, string> = {};
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colLetter(colNumber)] = formatCell(cell.value);
  });

  async function* iterator(): AsyncIterable<RawRow> {
    for (let r = 2; r <= rowCount; r++) {
      const row = sheet.getRow(r);
      const cells: Record<string, string | null> = {};
      for (let c = 1; c <= colCount; c++) {
        const formatted = formatCell(row.getCell(c).value);
        cells[colLetter(c)] = formatted === "" ? null : formatted;
      }
      yield { rowNumber: r, cells };
    }
  }

  return {
    headers,
    totalRows: rowCount - 1,
    rows: iterator(),
  };
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function formatCell(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return formatDate(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((p) => p.text).join("");
    }
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return formatCell(v.result as ExcelJS.CellValue);
    if ("hyperlink" in v) return String(v.hyperlink);
    return JSON.stringify(v);
  }
  return String(v).trim();
}

// Date-only cells in xlsx land as midnight in some TZ; `toISOString()` shifts
// to UTC and can drift across midnight (`2024-01-15T00:00:00+08:00` →
// `2024-01-14T16:00:00Z` → wrong day). For pure date-only cells (h/m/s/ms all
// zero in UTC), emit YYYY-MM-DD from getUTC* directly. For timestamped cells,
// fall back to full ISO so downstream can preserve time precision.
function formatDate(v: Date): string {
  const isDateOnly =
    v.getUTCHours() === 0 &&
    v.getUTCMinutes() === 0 &&
    v.getUTCSeconds() === 0 &&
    v.getUTCMilliseconds() === 0;
  if (isDateOnly) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return v.toISOString();
}
