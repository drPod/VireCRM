/**
 * Row-builders that turn an `IndexMap` (column-name → column-index) plus
 * a 2D string grid into validated `ParsedLead` records + `ParseIssue`
 * warnings. The heuristic-header path (`buildLeadsFromIndices`) is used
 * by both CSV and XLSX parsers; the AI-mapping path
 * (`buildLeadsFromAiMapping`) wraps it after asking the model where each
 * canonical field lives.
 */

import type { ImportColumnMapping } from "@/functions/import-mapping.functions";
import type { IndexMap, ParseIssue, ParseOutcome, ParsedLead, RawSheet } from "@/types/import";
import {
  ADDRESS_HEADERS,
  ANNUAL_KWH_HEADERS,
  CONTRACT_END_HEADERS,
  CONTRACT_START_HEADERS,
  COST_PER_KWH_HEADERS,
  DEAL_NAME_HEADERS,
  EMAIL_RE,
  ESI_HEADERS,
  MILS_HEADERS,
  SUPPLIER_HEADERS,
  TITLE_HEADERS,
  VALID_STATUSES,
  normalizeHeader,
} from "./headers";
import { parseAnnualKwh, parseContractDate, parseCostPerKwh, parseMils } from "./field-parsers";

export function buildLeadsFromIndices(m: IndexMap): ParseOutcome {
  const leads: ParsedLead[] = [];
  const issues: ParseIssue[] = [];

  m.rows.forEach((row, idx) => {
    const rowNum = idx + m.rowOffset;
    const name = m.nameIdx >= 0 ? (row[m.nameIdx] ?? "").toString().trim() : "";
    if (!name) {
      // Skip silently if the entire row is empty; otherwise log as an issue.
      const allEmpty = row.every((c) => !c?.toString().trim());
      if (!allEmpty) issues.push({ row: rowNum, message: "missing name" });
      return;
    }

    const rawEmail = m.emailIdx >= 0 ? (row[m.emailIdx] ?? "").toString().trim() : "";
    let email: string | undefined;
    if (rawEmail) {
      const normalized = rawEmail.toLowerCase();
      if (!EMAIL_RE.test(normalized)) {
        issues.push({ row: rowNum, message: `invalid email "${rawEmail}"` });
      } else {
        email = normalized;
      }
    }

    const statusRaw =
      m.statusIdx >= 0 ? (row[m.statusIdx] ?? "").toString().trim().toLowerCase() : "";
    const scoreRaw =
      m.scoreIdx >= 0 ? parseInt((row[m.scoreIdx] ?? "").toString().trim(), 10) : NaN;

    // Energy fields — soft warnings on bad values, never block the row.
    let annualKwh: number | null = null;
    if (m.annualKwhIdx >= 0) {
      const rawKwh = (row[m.annualKwhIdx] ?? "").toString();
      if (rawKwh.trim()) {
        annualKwh = parseAnnualKwh(rawKwh);
        if (annualKwh === null) {
          issues.push({ row: rowNum, message: `unreadable annual kWh "${rawKwh}"` });
        }
      }
    }

    let contractStart: string | null = null;
    if (m.contractStartIdx >= 0) {
      const rawDate = (row[m.contractStartIdx] ?? "").toString();
      if (rawDate.trim()) {
        contractStart = parseContractDate(rawDate);
        if (contractStart === null) {
          issues.push({ row: rowNum, message: `unreadable contract start date "${rawDate}"` });
        }
      }
    }

    let contractEnd: string | null = null;
    if (m.contractEndIdx >= 0) {
      const rawDate = (row[m.contractEndIdx] ?? "").toString();
      if (rawDate.trim()) {
        contractEnd = parseContractDate(rawDate);
        if (contractEnd === null) {
          issues.push({ row: rowNum, message: `unreadable contract end date "${rawDate}"` });
        }
      }
    }

    const supplier =
      m.supplierIdx >= 0 ? (row[m.supplierIdx] ?? "").toString().trim() || null : null;

    let costPerKwh: number | null = null;
    if (m.costPerKwhIdx >= 0) {
      const rawCost = (row[m.costPerKwhIdx] ?? "").toString();
      if (rawCost.trim()) {
        costPerKwh = parseCostPerKwh(rawCost);
        if (costPerKwh === null) {
          issues.push({ row: rowNum, message: `unreadable cost per kWh "${rawCost}"` });
        }
      }
    }

    let agentMils: number | null = null;
    if (m.milsIdx >= 0) {
      const rawMils = (row[m.milsIdx] ?? "").toString();
      if (rawMils.trim()) {
        agentMils = parseMils(rawMils);
        if (agentMils === null) {
          issues.push({ row: rowNum, message: `unreadable mils "${rawMils}"` });
        }
      }
    }

    leads.push({
      name,
      email,
      phone: m.phoneIdx >= 0 ? (row[m.phoneIdx] ?? "").toString().trim() || undefined : undefined,
      company:
        m.companyIdx >= 0 ? (row[m.companyIdx] ?? "").toString().trim() || undefined : undefined,
      status:
        statusRaw && (VALID_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : "new",
      score: !isNaN(scoreRaw) ? Math.min(100, Math.max(0, scoreRaw)) : 50,
      notes: m.notesIdx >= 0 ? (row[m.notesIdx] ?? "").toString().trim() || undefined : undefined,
      source:
        m.sourceIdx >= 0
          ? (row[m.sourceIdx] ?? "").toString().trim() || undefined
          : m.defaultSource,
      title: m.titleIdx >= 0 ? (row[m.titleIdx] ?? "").toString().trim() || undefined : undefined,
      deal_name:
        m.dealNameIdx >= 0 ? (row[m.dealNameIdx] ?? "").toString().trim() || undefined : undefined,
      service_address:
        m.addressIdx >= 0 ? (row[m.addressIdx] ?? "").toString().trim() || undefined : undefined,
      esi_id: m.esiIdx >= 0 ? (row[m.esiIdx] ?? "").toString().trim() || undefined : undefined,
      annual_kwh: annualKwh,
      contract_start_date: contractStart,
      contract_end_date: contractEnd,
      current_supplier: supplier,
      cost_per_kwh: costPerKwh,
      agent_mils: agentMils,
    });
  });

  return { leads, issues };
}

/**
 * Build leads using an AI-produced column mapping. Used when the heuristic
 * header detection fails. If the AI says row 1 is actually data, we prepend
 * it to the data rows.
 */
export function buildLeadsFromAiMapping(raw: RawSheet, mapping: ImportColumnMapping): ParseOutcome {
  // Resolve each canonical field's source -> column index.
  const resolveIdx = (
    src: { kind: "header"; key: string } | { kind: "index"; index: number } | null | undefined,
  ): number => {
    if (!src) return -1;
    if (src.kind === "index") return src.index;
    const norm = normalizeHeader(src.key);
    return raw.headers.findIndex((h) => normalizeHeader(h) === norm);
  };

  const nameIdx = resolveIdx(mapping.fields.name);
  if (nameIdx < 0) {
    return {
      leads: [],
      issues: [],
      fatal: `AI couldn't find a name column either. ${mapping.explanation}`,
    };
  }

  const dataRows = mapping.rowOneIsData ? [raw.headers, ...raw.rows] : raw.rows;
  const rowOffset = mapping.rowOneIsData ? 1 : 2;

  // AI mapper covers energy fields as of Step 3, but keep heuristic header
  // matching as a fallback when the AI returns null on a column we can still
  // see by name (e.g. it skipped "ESI" because the row sample was sparse).
  const normalizedRawHeaders = raw.headers.map((h) => normalizeHeader(String(h ?? "")));
  const findRaw = (dict: readonly string[]) =>
    normalizedRawHeaders.findIndex((h) => dict.includes(h));
  const aiOrHeuristic = (src: ReturnType<typeof resolveIdx> | number, dict: readonly string[]) =>
    typeof src === "number" && src >= 0 ? src : findRaw(dict);

  return buildLeadsFromIndices({
    rows: dataRows,
    rowOffset,
    nameIdx,
    emailIdx: resolveIdx(mapping.fields.email),
    phoneIdx: resolveIdx(mapping.fields.phone),
    companyIdx: resolveIdx(mapping.fields.company),
    statusIdx: resolveIdx(mapping.fields.status),
    scoreIdx: -1, // AI mapper doesn't produce score yet
    notesIdx: resolveIdx(mapping.fields.notes),
    sourceIdx: resolveIdx(mapping.fields.source),
    titleIdx: aiOrHeuristic(resolveIdx(mapping.fields.title), TITLE_HEADERS),
    dealNameIdx: aiOrHeuristic(resolveIdx(mapping.fields.deal_name), DEAL_NAME_HEADERS),
    addressIdx: aiOrHeuristic(resolveIdx(mapping.fields.service_address), ADDRESS_HEADERS),
    esiIdx: aiOrHeuristic(resolveIdx(mapping.fields.esi_id), ESI_HEADERS),
    annualKwhIdx: aiOrHeuristic(resolveIdx(mapping.fields.annual_kwh), ANNUAL_KWH_HEADERS),
    contractStartIdx: aiOrHeuristic(
      resolveIdx(mapping.fields.contract_start_date),
      CONTRACT_START_HEADERS,
    ),
    contractEndIdx: aiOrHeuristic(
      resolveIdx(mapping.fields.contract_end_date),
      CONTRACT_END_HEADERS,
    ),
    supplierIdx: aiOrHeuristic(resolveIdx(mapping.fields.current_supplier), SUPPLIER_HEADERS),
    costPerKwhIdx: aiOrHeuristic(resolveIdx(mapping.fields.cost_per_kwh), COST_PER_KWH_HEADERS),
    milsIdx: aiOrHeuristic(resolveIdx(mapping.fields.agent_mils), MILS_HEADERS),
    defaultSource: raw.sheetName === "csv" ? "csv_import" : "xlsx_import",
  });
}
