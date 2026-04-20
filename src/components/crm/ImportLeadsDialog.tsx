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
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Download, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAutoOutreach } from "@/hooks/useAutoOutreach";
import { useAutoOutreachPreference } from "@/hooks/useAutoOutreachPreference";
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
}

const VALID_STATUSES = ["new", "contacted", "qualified", "negotiation", "won", "lost"];

/** Same RFC-5322-lite check used everywhere else in the app. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCSV(text: string): ParseOutcome {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { leads: [], issues: [], fatal: "File looks empty — need a header row plus at least one data row." };
  }

  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  const nameIdx = headers.findIndex((h) => ["name", "full name", "fullname", "contact", "lead"].includes(h));
  const emailIdx = headers.findIndex((h) => ["email", "e-mail", "email address"].includes(h));
  const phoneIdx = headers.findIndex((h) => ["phone", "telephone", "tel", "mobile", "phone number"].includes(h));
  const companyIdx = headers.findIndex((h) => ["company", "organization", "org", "business", "company name"].includes(h));
  const statusIdx = headers.findIndex((h) => ["status", "stage", "lead status"].includes(h));
  const scoreIdx = headers.findIndex((h) => ["score", "lead score", "rating"].includes(h));
  const notesIdx = headers.findIndex((h) => ["notes", "note", "comments", "description"].includes(h));
  const sourceIdx = headers.findIndex((h) => ["source", "lead source", "origin", "channel"].includes(h));

  if (nameIdx === -1) {
    return {
      leads: [],
      issues: [],
      fatal: `Missing "Name" column. Detected headers: ${headers.join(", ") || "(none)"}.`,
    };
  }

  const leads: ParsedLead[] = [];
  const issues: ParseIssue[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed for the user (header is row 1)
    const values = parseCSVLine(lines[i]);
    const name = values[nameIdx]?.trim();
    if (!name) {
      issues.push({ row: rowNum, message: "missing name" });
      continue;
    }

    const rawEmail = emailIdx >= 0 ? values[emailIdx]?.trim() : undefined;
    let email: string | undefined;
    if (rawEmail) {
      const normalized = rawEmail.toLowerCase();
      if (!EMAIL_RE.test(normalized)) {
        issues.push({ row: rowNum, message: `invalid email "${rawEmail}"` });
      } else {
        email = normalized;
      }
    }

    const statusRaw = statusIdx >= 0 ? values[statusIdx]?.trim().toLowerCase() : undefined;
    const scoreRaw = scoreIdx >= 0 ? parseInt(values[scoreIdx]?.trim(), 10) : undefined;

    leads.push({
      name,
      email,
      phone: phoneIdx >= 0 ? values[phoneIdx]?.trim() || undefined : undefined,
      company: companyIdx >= 0 ? values[companyIdx]?.trim() || undefined : undefined,
      status: statusRaw && VALID_STATUSES.includes(statusRaw) ? statusRaw : "new",
      score: scoreRaw && !isNaN(scoreRaw) ? Math.min(100, Math.max(0, scoreRaw)) : 50,
      notes: notesIdx >= 0 ? values[notesIdx]?.trim() || undefined : undefined,
      source: sourceIdx >= 0 ? values[sourceIdx]?.trim() || undefined : "csv_import",
    });
  }
  return { leads, issues };
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
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheetName],
    { defval: "" }
  );
  if (rows.length === 0) {
    return { leads: [], issues: [], fatal: `Sheet "${sheetName}" is empty.` };
  }

  const normalize = (key: string) => key.trim().toLowerCase().replace(/['"]/g, "");

  // Validate that we have a name-ish header in row 1.
  const firstRow = rows[0];
  const headerKeys = Object.keys(firstRow).map(normalize);
  const NAME_HEADERS = ["name", "full name", "fullname", "contact", "lead"];
  if (!headerKeys.some((h) => NAME_HEADERS.includes(h))) {
    return {
      leads: [],
      issues: [],
      fatal: `Missing "Name" column in sheet "${sheetName}". Detected headers: ${headerKeys.join(", ")}.`,
    };
  }

  const leads: ParsedLead[] = [];
  const issues: ParseIssue[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +2: header is row 1, data starts at row 2
    const mapped: Record<string, string> = {};
    for (const [key, val] of Object.entries(row)) {
      mapped[normalize(key)] = String(val ?? "");
    }

    const name =
      mapped["name"] || mapped["full name"] || mapped["fullname"] || mapped["contact"] || mapped["lead"];
    if (!name?.trim()) {
      issues.push({ row: rowNum, message: "missing name" });
      return;
    }

    const rawEmail = (mapped["email"] || mapped["e-mail"] || mapped["email address"] || "").trim();
    let email: string | undefined;
    if (rawEmail) {
      const normalized = rawEmail.toLowerCase();
      if (!EMAIL_RE.test(normalized)) {
        issues.push({ row: rowNum, message: `invalid email "${rawEmail}"` });
      } else {
        email = normalized;
      }
    }

    const phone = mapped["phone"] || mapped["telephone"] || mapped["tel"] || mapped["mobile"] || undefined;
    const company = mapped["company"] || mapped["organization"] || mapped["org"] || mapped["business"] || undefined;
    const statusRaw = (mapped["status"] || mapped["stage"] || "").toLowerCase();
    const scoreRaw = parseInt(mapped["score"] || mapped["lead score"] || mapped["rating"] || "", 10);

    leads.push({
      name: name.trim(),
      email,
      phone: phone?.trim() || undefined,
      company: company?.trim() || undefined,
      status: statusRaw && VALID_STATUSES.includes(statusRaw) ? statusRaw : "new",
      score: !isNaN(scoreRaw) ? Math.min(100, Math.max(0, scoreRaw)) : 50,
      notes: (mapped["notes"] || mapped["note"] || mapped["comments"] || "").trim() || undefined,
      source: (mapped["source"] || mapped["lead source"] || mapped["origin"] || "").trim() || "xlsx_import",
    });
  });

  return { leads, issues };
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
  const { organization } = useAuth();
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
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setParsed([]);
    setImportResult(null);
    setParseError(null);
  }, []);

  const handleFile = useCallback(async (f: File) => {
    setParseError(null);
    setImportResult(null);
    setFile(f);

    try {
      const isExcel = /\.xlsx?$/i.test(f.name);
      let leads: ParsedLead[];

      if (isExcel) {
        const buffer = await f.arrayBuffer();
        leads = parseXLSX(buffer);
      } else {
        const text = await f.text();
        leads = parseCSV(text);
      }

      if (leads.length === 0) {
        setParseError(
          'No leads found. Make sure your file has a header row with a "Name" column.'
        );
        setParsed([]);
      } else {
        setParsed(leads);
      }
    } catch {
      setParseError("Failed to read the file. Please check the format.");
      setParsed([]);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleImport = async () => {
    if (!organization?.id || parsed.length === 0) return;
    setLoading(true);

    const BATCH_SIZE = 50;
    let success = 0;
    let failed = 0;
    const allInserted: Array<{ id: string; name: string; email: string | null; company: string | null }> = [];

    for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
      const batch = parsed.slice(i, i + BATCH_SIZE).map((l) => ({
        organization_id: organization.id,
        name: l.name.slice(0, 200),
        email: l.email?.slice(0, 255) || null,
        phone: l.phone?.slice(0, 50) || null,
        company: l.company?.slice(0, 200) || null,
        status: l.status || "new",
        score: l.score ?? 50,
        notes: l.notes?.slice(0, 2000) || null,
        source: l.source || "csv_import",
      }));

      const { error, data } = await supabase.from("leads").insert(batch).select("id, name, email, company");
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
    const csv = "Name,Email,Phone,Company,Status,Score,Notes,Source\nJane Smith,jane@acme.com,+1 555-0123,Acme Corp,new,75,Met at conference,referral\n";
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
            <Button variant="outline" size="sm" onClick={() => { reset(); setOpen(false); }}>
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

            {parseError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {parseError}
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
                            <td className="px-3 py-1.5 text-muted-foreground">{l.company || "—"}</td>
                            <td className="px-3 py-1.5 capitalize text-muted-foreground">{l.status}</td>
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
