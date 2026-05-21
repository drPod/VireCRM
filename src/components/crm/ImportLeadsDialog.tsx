import { useState, useCallback } from "react";
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
import { useServerFn } from "@tanstack/react-start";
import { mapImportColumnsFn } from "@/functions/import-mapping.functions";
import { toast } from "sonner";
import type { ParseOutcome, ParseIssue, ParsedLead } from "@/types/import";
import { parseCSV } from "@/lib/import/csv-parser";
import { parseXLSX } from "@/lib/import/xlsx-parser";
import { buildLeadsFromAiMapping } from "@/lib/import/builder";

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
  // Historical-backfill mode: override every imported row's status to "won"
  // and suppress auto-outreach. For energy brokers like Green EnergiAi who
  // are loading their existing client list at onboarding, not new leads.
  const [backfillMode, setBackfillMode] = useState<boolean>(false);

  const mapColumns = useServerFn(mapImportColumnsFn);

  const reset = useCallback(() => {
    setFile(null);
    setParsed([]);
    setIssues([]);
    setImportResult(null);
    setParseError(null);
    setAiNote(null);
    setBackfillMode(false);
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
        status: backfillMode ? "won" : l.status || "new",
        score: l.score ?? 50,
        notes: l.notes?.slice(0, 2000) || null,
        source: l.source || "csv_import",
        // Energy-broker fields — were parsed but dropped pre-Step-2.
        title: l.title?.slice(0, 100) || null,
        deal_name: l.deal_name?.slice(0, 200) || null,
        service_address: l.service_address?.slice(0, 500) || null,
        esi_id: l.esi_id?.slice(0, 200) || null,
        annual_kwh: l.annual_kwh ?? null,
        contract_start_date: l.contract_start_date || null,
        contract_end_date: l.contract_end_date || null,
        current_supplier: l.current_supplier?.slice(0, 200) || null,
        cost_per_kwh: l.cost_per_kwh ?? null,
        agent_mils: l.agent_mils ?? null,
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

      // Trigger auto-outreach in background — only if the user opted in
      // and backfill mode is off (don't email historical clients).
      if (outreachEnabled && !backfillMode && allInserted.length > 0) {
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
                    htmlFor="backfill-import"
                    className="flex flex-col gap-0.5 text-xs font-medium text-foreground cursor-pointer"
                  >
                    <span>Import as closed clients (historical backfill)</span>
                    <span className="font-normal text-muted-foreground">
                      Sets every row to status &ldquo;won&rdquo; and disables auto-outreach. Use
                      when loading existing customers, not new leads.
                    </span>
                  </label>
                  <Switch
                    id="backfill-import"
                    checked={backfillMode}
                    onCheckedChange={setBackfillMode}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <label
                    htmlFor="auto-outreach-import"
                    className={`flex items-center gap-2 text-xs font-medium ${
                      backfillMode
                        ? "text-muted-foreground cursor-not-allowed"
                        : "text-foreground cursor-pointer"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    AI auto-outreach
                    <span className="font-normal text-muted-foreground">
                      {backfillMode
                        ? "— disabled in backfill mode"
                        : "— email imported leads with addresses"}
                    </span>
                  </label>
                  <Switch
                    id="auto-outreach-import"
                    checked={outreachEnabled && !backfillMode}
                    onCheckedChange={setOutreachEnabled}
                    disabled={backfillMode}
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
