#!/usr/bin/env bun
// Phase 0.5 inspect script — dumps xlsx structure before locking schema.
// Doc 06 §1 (the 83-col field map) was authored from this script's output.
// Re-run when source xlsx changes. Reads `Copy of NGP MASTER LIST - Copy.xlsx`
// at repo root by default; pass a path arg to override.
//
// Usage:
//   bun scripts/inspect-xlsx.ts
//   bun scripts/inspect-xlsx.ts path/to/other.xlsx

import { resolve } from "node:path";
import * as ExcelJS from "exceljs";

const DEFAULT_PATH = "Copy of NGP MASTER LIST - Copy.xlsx";
const PREVIEW_ROWS = 20;
const ENUM_CARDINALITY_CUTOFF = 50;
const ENUM_PREVIEW = 30;

const xlsxPath = resolve(process.cwd(), process.argv[2] ?? DEFAULT_PATH);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(xlsxPath);

console.log(`# ${xlsxPath}\n`);
console.log(`Sheets: ${wb.worksheets.map((s) => `"${s.name}"`).join(", ")}`);

const sheet = wb.worksheets[0];
if (!sheet) {
  console.error("No sheets in workbook.");
  process.exit(1);
}

const rowCount = sheet.actualRowCount;
const colCount = sheet.actualColumnCount;
console.log(`Active sheet: "${sheet.name}" — ${rowCount} rows × ${colCount} cols\n`);

const headers: string[] = [];
sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
  headers[colNumber - 1] = String(cell.value ?? "").trim();
});

console.log(`## Column headers (${headers.length})\n`);
headers.forEach((h, i) => {
  const letter = colLetter(i + 1);
  console.log(`${String(i + 1).padStart(2, " ")}. ${letter.padEnd(3, " ")} ${h || "(empty)"}`);
});

console.log(`\n## First ${PREVIEW_ROWS} data rows\n`);
for (let r = 2; r <= Math.min(1 + PREVIEW_ROWS, rowCount); r++) {
  const row = sheet.getRow(r);
  console.log(`--- row ${r} ---`);
  headers.forEach((h, i) => {
    const v = formatCell(row.getCell(i + 1).value);
    if (v === "") return;
    console.log(`  ${h}: ${v}`);
  });
}

console.log(`\n## Distinct values per column (cardinality ≤ ${ENUM_CARDINALITY_CUTOFF})\n`);
for (let c = 1; c <= headers.length; c++) {
  const header = headers[c - 1];
  if (!header) continue;
  const distinct = new Set<string>();
  let blanks = 0;
  for (let r = 2; r <= rowCount; r++) {
    const v = formatCell(sheet.getRow(r).getCell(c).value);
    if (v === "") {
      blanks++;
      continue;
    }
    distinct.add(v);
    if (distinct.size > ENUM_CARDINALITY_CUTOFF) break;
  }
  if (distinct.size === 0 || distinct.size > ENUM_CARDINALITY_CUTOFF) continue;
  const preview = [...distinct].slice(0, ENUM_PREVIEW).join(" | ");
  console.log(
    `[${colLetter(c)}] ${header} — ${distinct.size} distinct (${blanks} blank): ${preview}`,
  );
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
  if (v instanceof Date) return v.toISOString();
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
