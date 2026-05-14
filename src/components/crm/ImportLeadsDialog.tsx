import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAutoOutreach } from "@/hooks/useAutoOutreach";
import { useAutoOutreachPreference } from "@/hooks/useAutoOutreachPreference";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { mapImportColumnsFn, type ImportColumnMapping } from "@/functions/import-mapping.functions";
import { toast } from "sonner";

interface ParsedLead {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: string;
  score?: number;
  notes?: string;
  source?: string;
  /** Annual electricity usage in kWh (energy-broker workflow). */
  annual_kwh?: number | null;
  /** Contract end date as ISO YYYY-MM-DD. */
  contract_end_date?: string | null;
  /** Current energy supplier name. */
  current_supplier?: string | null;
}

/** Per-row warning/error captured during parsing — surfaced to the user. */
interface ParseIssue {
  row: number; // 1-indexed, matches what the user sees in their spreadsheet
  message: string;
}

interface ParseOutcome {
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
interface RawSheet {
  /** Raw header strings as they appeared in row 1. May actually be data. */
  headers: string[];
  /** Each row is the same length as headers; missing cells are "". */
  rows: string[][];
  /** Sheet name (xlsx) or "csv" — used in fallback messaging. */
  sheetName: string;
}

const VALID_STATUSES = ["new", "contacted", "qualified", "negotiation", "won", "lost"];

/** Same RFC-5322-lite check used everywhere else in the app. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_HEADERS = ["name", "full name", "fullname", "contact", "lead"];
const EMAIL_HEADERS = ["email", "e-mail", "email address"];
const PHONE_HEADERS = ["phone", "telephone", "tel", "mobile", "phone number"];
const COMPANY_HEADERS = ["company", "organization", "org", "business", "company name"];
const STATUS_HEADERS = ["status", "stage", "lead status"];
const SCORE_HEADERS = ["score", "lead score", "rating"];
const NOTES_HEADERS = ["notes", "note", "comments", "description"];
const SOURCE_HEADERS = ["source", "lead source", "origin", "channel"];
const ANNUAL_KWH_HEADERS = [
  "annual kwh",
  "annual usage",
  "annual usage kwh",
  "kwh",
  "yearly kwh",
  "yearly usage",
  "consumption",
  "annual consumption",
  "usage",
  "usage kwh",
];
const CONTRACT_END_HEADERS = [
  "contract end",
  "contract end date",
  "contract expiry",
  "contract expiration",
  "expiry date",
  "expiration date",
  "renewal date",
  "end date",
  "ced",
];
const SUPPLIER_HEADERS = [
  "current supplier",
  "supplier",
  "energy supplier",
  "utility",
  "utility provider",
  "provider",
  "incumbent supplier",
  "current provider",
];

const normalizeHeader = (key: string) => key.trim().toLowerCase().replace(/['"]/g, "");

function parseCSV(text: string): ParseOutcome {
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

  const normalized = headers.map(normalizeHeader);
  const nameIdx = normalized.findIndex((h) => NAME_HEADERS.includes(h));

  if (nameIdx === -1) {
    // Hand off to the AI fallback — caller decides what to do.
    return {
      leads: [],
      issues: [],
      raw: rawSheet,
      fatal: `Missing "Name" column. Detected headers: ${headers.join(", ") || "(none)"}.`,
    };
  }

  const emailIdx = normalized.findIndex((h) => EMAIL_HEADERS.includes(h));
  const phoneIdx = normalized.findIndex((h) => PHONE_HEADERS.includes(h));
  const companyIdx = normalized.findIndex((h) => COMPANY_HEADERS.includes(h));
  const statusIdx = normalized.findIndex((h) => STATUS_HEADERS.includes(h));
  const scoreIdx = normalized.findIndex((h) => SCORE_HEADERS.includes(h));
  const notesIdx = normalized.findIndex((h) => NOTES_HEADERS.includes(h));
  const sourceIdx = normalized.findIndex((h) => SOURCE_HEADERS.includes(h));
  const annualKwhIdx = normalized.findIndex((h) => ANNUAL_KWH_HEADERS.includes(h));
  const contractEndIdx = normalized.findIndex((h) => CONTRACT_END_HEADERS.includes(h));
  const supplierIdx = normalized.findIndex((h) => SUPPLIER_HEADERS.includes(h));

  return buildLeadsFromIndices({
    rows: dataRows,
    rowOffset: 2, // header is row 1, data starts row 2
    nameIdx,
    emailIdx,
    phoneIdx,
    companyIdx,
    statusIdx,
    scoreIdx,
    notesIdx,
    sourceIdx,
    annualKwhIdx,
    contractEndIdx,
    supplierIdx,
    defaultSource: "csv_import",
  });
}

function parseCSVLine(line: string): string[] {
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

function parseXLSX(buffer: ArrayBuffer): ParseOutcome {
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
  const nameIdx = normalized.findIndex((h) => NAME_HEADERS.includes(h));

  if (nameIdx === -1) {
    return {
      leads: [],
      issues: [],
      raw: rawSheet,
      fatal: `Missing "Name" column in sheet "${sheetName}". Detected headers: ${normalized.join(", ")}.`,
    };
  }

  const emailIdx = normalized.findIndex((h) => EMAIL_HEADERS.includes(h));
  const phoneIdx = normalized.findIndex((h) => PHONE_HEADERS.includes(h));
  const companyIdx = normalized.findIndex((h) => COMPANY_HEADERS.includes(h));
  const statusIdx = normalized.findIndex((h) => STATUS_HEADERS.includes(h));
  const scoreIdx = normalized.findIndex((h) => SCORE_HEADERS.includes(h));
  const notesIdx = normalized.findIndex((h) => NOTES_HEADERS.includes(h));
  const sourceIdx = normalized.findIndex((h) => SOURCE_HEADERS.includes(h));
  const annualKwhIdx = normalized.findIndex((h) => ANNUAL_KWH_HEADERS.includes(h));
  const contractEndIdx = normalized.findIndex((h) => CONTRACT_END_HEADERS.includes(h));
  const supplierIdx = normalized.findIndex((h) => SUPPLIER_HEADERS.includes(h));

  return buildLeadsFromIndices({
    rows: dataRows,
    rowOffset: 2,
    nameIdx,
    emailIdx,
    phoneIdx,
    companyIdx,
    statusIdx,
    scoreIdx,
    notesIdx,
    sourceIdx,
    annualKwhIdx,
    contractEndIdx,
    supplierIdx,
    defaultSource: "xlsx_import",
  });
}

interface IndexMap {
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
  annualKwhIdx: number;
  contractEndIdx: number;
  supplierIdx: number;
  defaultSource: string;
}

/** Parse "12,345", "12345 kWh", "12.5k" loosely into a positive integer kWh. */
function parseAnnualKwh(raw: string): number | null {
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
 * Parse a contract end date cell into ISO YYYY-MM-DD. Accepts:
 * - YYYY-MM-DD / YYYY/MM/DD
 * - DD/MM/YYYY or DD-MM-YYYY (UK convention — common in energy contracts)
 * - Excel serial numbers (days since 1899-12-30)
 * - Anything Date.parse() understands as a last resort.
 * Returns null when the cell is blank or unparseable.
 */
function parseContractEndDate(raw: string): string | null {
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
    let [, d, m, y] = ukMatch;
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

function buildLeadsFromIndices(m: IndexMap): ParseOutcome {
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

    let contractEnd: string | null = null;
    if (m.contractEndIdx >= 0) {
      const rawDate = (row[m.contractEndIdx] ?? "").toString();
      if (rawDate.trim()) {
        contractEnd = parseContractEndDate(rawDate);
        if (contractEnd === null) {
          issues.push({ row: rowNum, message: `unreadable contract end date "${rawDate}"` });
        }
      }
    }

    const supplier =
      m.supplierIdx >= 0 ? (row[m.supplierIdx] ?? "").toString().trim() || null : null;

    leads.push({
      name,
      email,
      phone: m.phoneIdx >= 0 ? (row[m.phoneIdx] ?? "").toString().trim() || undefined : undefined,
      company:
        m.companyIdx >= 0 ? (row[m.companyIdx] ?? "").toString().trim() || undefined : undefined,
      status: statusRaw && VALID_STATUSES.includes(statusRaw) ? statusRaw : "new",
      score: !isNaN(scoreRaw) ? Math.min(100, Math.max(0, scoreRaw)) : 50,
      notes: m.notesIdx >= 0 ? (row[m.notesIdx] ?? "").toString().trim() || undefined : undefined,
      source:
        m.sourceIdx >= 0
          ? (row[m.sourceIdx] ?? "").toString().trim() || undefined
          : m.defaultSource,
      annual_kwh: annualKwh,
      contract_end_date: contractEnd,
      current_supplier: supplier,
    });
  });

  return { leads, issues };
}

/**
 * Build leads using an AI-produced column mapping. Used when the heuristic
 * header detection fails. If the AI says row 1 is actually data, we prepend
 * it to the data rows.
 */
function buildLeadsFromAiMapping(raw: RawSheet, mapping: ImportColumnMapping): ParseOutcome {
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

  // AI mapper doesn't know about energy fields yet — fall back to heuristic
  // header matching against the raw headers so we still capture them when
  // present.
  const normalizedRawHeaders = raw.headers.map((h) => normalizeHeader(String(h ?? "")));
  const annualKwhIdx = normalizedRawHeaders.findIndex((h) => ANNUAL_KWH_HEADERS.includes(h));
  const contractEndIdx = normalizedRawHeaders.findIndex((h) => CONTRACT_END_HEADERS.includes(h));
  const supplierIdx = normalizedRawHeaders.findIndex((h) => SUPPLIER_HEADERS.includes(h));

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
    annualKwhIdx,
    contractEndIdx,
    supplierIdx,
    defaultSource: raw.sheetName === "csv" ? "csv_import" : "xlsx_import",
  });
}

interface ImportLeadsDialogProps {
  onLeadsImported?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function ImportLeadsDialog({
  onLeadsImported,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
}: ImportLeadsDialogProps) {
  const { organization, user } = useAuth();
  const { triggerOutreach } = useAutoOutreach();
  const { enabled: outreachEnabled, setEnabled: setOutreachEnabled } = useAutoOutreachPreference();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    controlledOnOpenChange?.(v);
  };
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedLead[]>([]);
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(
    null,
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [aiMapping, setAiMapping] = useState<boolean>(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const mapColumns = useAuthedServerFn(mapImportColumnsFn);

  const reset = useCallback(() => {
    setFile(null);
    setParsed([]);
    setIssues([]);
    setImportResult(null);
    setParseError(null);
    setAiNote(null);
  }, []);

  const handleFile = useCallback(
    async (f: File) => {
      setParseError(null);
      setIssues([]);
      setImportResult(null);
      setAiNote(null);
      setFile(f);

      try {
        const isExcel = /\.xlsx?$/i.test(f.name);
        const isCsv = /\.(csv|txt)$/i.test(f.name);

        if (!isExcel && !isCsv) {
          setParseError("Unsupported file format. Please upload a .csv, .txt, or .xlsx file.");
          setParsed([]);
          return;
        }

        let outcome: ParseOutcome;
        if (isExcel) {
          const buffer = await f.arrayBuffer();
          outcome = parseXLSX(buffer);
        } else {
          const text = await f.text();
          outcome = parseCSV(text);
        }

        // Heuristic header detection failed → try AI column mapping before giving up.
        if (outcome.fatal && outcome.raw) {
          setAiMapping(true);
          try {
            const mapping = await mapColumns({
              data: {
                headers: outcome.raw.headers.map((h) => String(h ?? "")),
                sampleRows: outcome.raw.rows.slice(0, 5).map((r) => r.map((c) => String(c ?? ""))),
              },
            });
            const aiOutcome = buildLeadsFromAiMapping(outcome.raw, mapping);
            if (aiOutcome.fatal) {
              setParseError(aiOutcome.fatal);
              setParsed([]);
              return;
            }
            if (aiOutcome.leads.length === 0) {
              setParseError(`AI couldn't extract any leads from this file. ${mapping.explanation}`);
              setParsed([]);
              setIssues(aiOutcome.issues);
              return;
            }
            setAiNote(`AI organized columns automatically — ${mapping.explanation}`);
            setParsed(aiOutcome.leads);
            setIssues(aiOutcome.issues);
            return;
          } catch (aiErr) {
            // AI failed too — fall back to original error.
            const aiMsg = aiErr instanceof Error ? aiErr.message : "AI mapping failed";
            setParseError(`${outcome.fatal} (AI fallback also failed: ${aiMsg})`);
            setParsed([]);
            return;
          } finally {
            setAiMapping(false);
          }
        }

        if (outcome.fatal) {
          setParseError(outcome.fatal);
          setParsed([]);
          return;
        }

        if (outcome.leads.length === 0) {
          const detail =
            outcome.issues.length > 0
              ? ` (${outcome.issues.length} row${outcome.issues.length > 1 ? "s" : ""} skipped — ${outcome.issues[0].message})`
              : "";
          setParseError(`0 valid rows detected${detail}.`);
          setParsed([]);
          setIssues(outcome.issues);
          return;
        }

        setParsed(outcome.leads);
        setIssues(outcome.issues);
      } catch (err) {
        setParseError(
          `Failed to read the file: ${err instanceof Error ? err.message : "unknown error"}`,
        );
        setParsed([]);
      }
    },
    [mapColumns],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleImport = async () => {
    if (!organization?.id || parsed.length === 0) return;
    if (!user?.id) {
      toast.error("Please wait for your account to finish loading, then try again");
      return;
    }
    setLoading(true);

    const BATCH_SIZE = 50;
    let success = 0;
    let failed = 0;
    const allInserted: Array<{
      id: string;
      name: string;
      email: string | null;
      company: string | null;
    }> = [];

    for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
      const batch = parsed.slice(i, i + BATCH_SIZE).map((l) => ({
        organization_id: organization.id,
        created_by: user.id,
        name: l.name.slice(0, 200),
        email: l.email?.slice(0, 255) || null,
        phone: l.phone?.slice(0, 50) || null,
        company: l.company?.slice(0, 200) || null,
        status: l.status || "new",
        score: l.score ?? 50,
        notes: l.notes?.slice(0, 2000) || null,
        source: l.source || "csv_import",
      }));

      const { error, data } = await supabase
        .from("leads")
        .insert(batch)
        .select("id, name, email, company");
      if (error) {
        failed += batch.length;
      } else {
        success += data?.length ?? batch.length;
        if (data) allInserted.push(...data);
      }
    }

    setImportResult({ success, failed });
    setLoading(false);

    if (success > 0) {
      toast.success(`Imported ${success} lead${success > 1 ? "s" : ""} successfully!`);
      onLeadsImported?.();

      // Trigger auto-outreach in background — only if the user opted in.
      if (outreachEnabled && allInserted.length > 0) {
        triggerOutreach(allInserted);
      }
    }
    if (failed > 0) {
      toast.error(`Failed to import ${failed} lead${failed > 1 ? "s" : ""}.`);
    }
  };

  const downloadTemplate = () => {
    const csv =
      "Name,Email,Phone,Company,Status,Score,Notes,Source\nJane Smith,jane@acme.com,+1 555-0123,Acme Corp,new,75,Met at conference,referral\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel (.xlsx) file with lead information to bulk-import contacts.
          </DialogDescription>
        </DialogHeader>

        {importResult ? (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{importResult.success}</span> leads imported
              {importResult.failed > 0 && (
                <span className="text-destructive"> · {importResult.failed} failed</span>
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/40 cursor-pointer"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".csv,.txt,.xlsx,.xls";
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleFile(f);
                };
                input.click();
              }}
            >
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {file ? file.name : "Drop a CSV or Excel file here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  CSV or XLSX with columns: Name (required), Email, Phone, Company, Status, Score
                </p>
              </div>
            </div>

            {/* Download template */}
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline mx-auto"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV template
            </button>

            {aiMapping && (
              <div className="flex items-center gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is organizing your spreadsheet columns…</span>
              </div>
            )}

            {aiNote && !parseError && (
              <div className="flex items-start gap-2 rounded-md bg-primary/10 p-3 text-xs text-primary">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>{aiNote}</p>
              </div>
            )}

            {parseError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p>{parseError}</p>
                  {issues.length > 0 && (
                    <ul className="list-disc pl-4 text-xs opacity-80">
                      {issues.slice(0, 5).map((iss, i) => (
                        <li key={i}>
                          Row {iss.row}: {iss.message}
                        </li>
                      ))}
                      {issues.length > 5 && <li>…and {issues.length - 5} more</li>}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {parsed.length > 0 && issues.length > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs text-warning">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">
                    {issues.length} row{issues.length > 1 ? "s" : ""} skipped
                  </span>
                  {" — "}
                  {issues
                    .slice(0, 3)
                    .map((i) => `row ${i.row} (${i.message})`)
                    .join(", ")}
                  {issues.length > 3 && `, +${issues.length - 3} more`}
                </div>
              </div>
            )}

            {parsed.length > 0 && (
              <>
                <div className="rounded-lg border border-border">
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Company</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.slice(0, 50).map((l, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="px-3 py-1.5 text-foreground">{l.name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{l.email || "—"}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {l.company || "—"}
                            </td>
                            <td className="px-3 py-1.5 capitalize text-muted-foreground">
                              {l.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.length > 50 && (
                    <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                      …and {parsed.length - 50} more
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <label
                    htmlFor="auto-outreach-import"
                    className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    AI auto-outreach
                    <span className="font-normal text-muted-foreground">
                      — email imported leads with addresses
                    </span>
                  </label>
                  <Switch
                    id="auto-outreach-import"
                    checked={outreachEnabled}
                    onCheckedChange={setOutreachEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {parsed.length} lead{parsed.length > 1 ? "s" : ""} ready to import
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={reset}>
                      Clear
                    </Button>
                    <Button variant="command" size="sm" onClick={handleImport} disabled={loading}>
                      {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Import {parsed.length} Lead{parsed.length > 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
