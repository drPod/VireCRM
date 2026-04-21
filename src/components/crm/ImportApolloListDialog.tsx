import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListPlus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Settings as SettingsIcon,
  KeyRound,
  Download,
  Users,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  listApolloListsFn,
  importApolloListFn,
  type ApolloListSummary,
  type ImportResult,
} from "@/functions/apollo-lists.functions";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

interface ImportApolloListDialogProps {
  onLeadsImported?: () => void;
}

type ErrorCode = "INTEGRATION_MISSING" | "AUTH" | "CREDITS" | null;

function parseServerError(msg: string): { code: ErrorCode; clean: string } {
  const m = msg.match(/^\[(INTEGRATION_MISSING|AUTH|CREDITS)\]\s*([\s\S]*)$/);
  if (!m) return { code: null, clean: msg };
  return { code: m[1] as ErrorCode, clean: m[2] };
}

const BATCH_OPTIONS = [25, 50, 100, 200] as const;

export function ImportApolloListDialog({ onLeadsImported }: ImportApolloListDialogProps) {
  const { organization, role } = useAuth();
  const isOwner = role?.role === "owner";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lists, setLists] = useState<ApolloListSummary[] | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [maxLeads, setMaxLeads] = useState<number>(50);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ErrorCode>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const fetchLists = useAuthedServerFn(listApolloListsFn);
  const importList = useAuthedServerFn(importApolloListFn);

  const reset = useCallback(() => {
    setLists(null);
    setSelectedListId(null);
    setError(null);
    setErrorCode(null);
    setResult(null);
  }, []);

  const loadLists = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const res = await fetchLists({ data: { organizationId: organization.id } });
      setLists(res.lists);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Failed to load lists";
      const { code, clean } = parseServerError(raw);
      setError(clean);
      setErrorCode(code);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, fetchLists]);

  useEffect(() => {
    if (open && !lists && !loading && !error) {
      void loadLists();
    }
  }, [open, lists, loading, error, loadLists]);

  const handleImport = async () => {
    if (!organization?.id || !selectedListId) return;
    const list = lists?.find((l) => l.id === selectedListId);
    if (!list) return;

    setImporting(true);
    setError(null);
    setErrorCode(null);
    try {
      const res = await importList({
        data: {
          organizationId: organization.id,
          listId: selectedListId,
          listName: list.name,
          maxLeads,
        },
      });
      setResult(res);
      if (res.inserted > 0) {
        toast.success(`Imported ${res.inserted} new lead${res.inserted > 1 ? "s" : ""} from "${list.name}"`);
        onLeadsImported?.();
      } else if (res.duplicates > 0) {
        toast.info(`All ${res.duplicates} leads from this list are already in your CRM.`);
      } else {
        toast.warning("No leads with verified emails found in this list.");
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Import failed";
      const { code, clean } = parseServerError(raw);
      setError(clean);
      setErrorCode(code);
    } finally {
      setImporting(false);
    }
  };

  const showSettingsCta =
    isOwner && (errorCode === "INTEGRATION_MISSING" || errorCode === "AUTH");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListPlus className="h-4 w-4" />
          Apollo Lists
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary" />
            Import from Apollo List
          </DialogTitle>
          <DialogDescription>
            Pull contacts from a saved list in your Apollo workspace. Each lead burns 1 Apollo credit on your account.
          </DialogDescription>
        </DialogHeader>

        {/* SUCCESS STATE */}
        {result ? (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <h3 className="text-base font-semibold text-foreground">Import complete</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-2xl font-bold text-foreground">{result.inserted}</div>
                <div className="text-xs text-muted-foreground">New leads added</div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-2xl font-bold text-foreground">{result.duplicates}</div>
                <div className="text-xs text-muted-foreground">Already in CRM</div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-2xl font-bold text-foreground">{result.revealed}</div>
                <div className="text-xs text-muted-foreground">Emails revealed</div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="text-2xl font-bold text-foreground">{result.noEmail}</div>
                <div className="text-xs text-muted-foreground">No verified email</div>
              </div>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => { setResult(null); setSelectedListId(null); }}>
                Import another
              </Button>
              <Button variant="command" size="sm" onClick={() => { setOpen(false); reset(); }}>
                Done
              </Button>
            </div>
          </div>
        ) : error ? (
          <div className="space-y-3 py-4">
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            {showSettingsCta && (
              <Link to="/settings" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  Open Settings → Integrations
                </Button>
              </Link>
            )}
            {errorCode === "INTEGRATION_MISSING" && !isOwner && (
              <p className="text-xs text-muted-foreground text-center">
                Ask your organization owner to add an Apollo API key.
              </p>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => { setError(null); setErrorCode(null); void loadLists(); }}>
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading your Apollo lists…
          </div>
        ) : lists && lists.length === 0 ? (
          <div className="space-y-3 py-6 text-center text-sm">
            <Users className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-foreground font-medium">No saved lists found</p>
            <p className="text-muted-foreground">
              Create a list in Apollo (People → Save to list), then come back to import.
            </p>
            <a
              href="https://app.apollo.io/#/people"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              Open Apollo →
            </a>
          </div>
        ) : lists ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs">
              <KeyRound className="h-3.5 w-3.5 text-success" />
              <span className="text-foreground font-medium">Using your Apollo workspace</span>
              <span className="text-muted-foreground">— credits billed by Apollo</span>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-foreground">
                Pick a list ({lists.length} available)
              </label>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {lists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setSelectedListId(list.id)}
                    className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      selectedListId === list.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">{list.name}</div>
                      {list.count !== null && (
                        <div className="text-xs text-muted-foreground">
                          {list.count.toLocaleString()} contact{list.count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                    {selectedListId === list.id && (
                      <Badge variant="info" className="ml-2 shrink-0">Selected</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {selectedListId && (
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Max leads to import
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {BATCH_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxLeads(n)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                        maxLeads === n
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-border/80"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Burns up to {maxLeads} Apollo email credits ({maxLeads} × $0.01 ≈ ${(maxLeads * 0.01).toFixed(2)}).
                </p>
              </div>
            )}

            <Button
              variant="command"
              className="w-full gap-2"
              onClick={handleImport}
              disabled={!selectedListId || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing & revealing emails…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Import {selectedListId ? maxLeads : ""} leads
                </>
              )}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
