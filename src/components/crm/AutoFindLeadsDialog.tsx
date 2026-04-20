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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Wand2,
  Loader2,
  UserPlus,
  Building2,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { findLeadsFn, type SuggestedLead } from "@/functions/find-leads.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAutoOutreach } from "@/hooks/useAutoOutreach";
import { useAutoOutreachPreference } from "@/hooks/useAutoOutreachPreference";
import { toast } from "sonner";

interface AutoFindLeadsDialogProps {
  onLeadsImported?: () => void;
}

export function AutoFindLeadsDialog({ onLeadsImported }: AutoFindLeadsDialogProps) {
  const { organization } = useAuth();
  const { triggerOutreach } = useAutoOutreach();
  const { enabled: outreachEnabled, setEnabled: setOutreachEnabled } = useAutoOutreachPreference();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  const findLeads = useServerFn(findLeadsFn);

  const reset = useCallback(() => {
    setSuggestions([]);
    setSelected(new Set());
    setError(null);
    setImported(false);
  }, []);

  const handleFind = async () => {
    if (!organization?.id || description.length < 10) return;
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const result = await findLeads({
        data: {
          organizationId: organization.id,
          businessDescription: description,
          industry: industry || undefined,
          count,
        },
      });
      setSuggestions(result.leads);
      setSelected(new Set(result.leads.map((_, i) => i)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to find leads";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === suggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(suggestions.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    if (!organization?.id || selected.size === 0) return;
    setImporting(true);

    const leadsToImport = suggestions
      .filter((_, i) => selected.has(i))
      .map((l) => ({
        organization_id: organization.id,
        name: l.name.slice(0, 200),
        email: l.email.slice(0, 255),
        phone: l.phone?.slice(0, 50) || null,
        company: l.company.slice(0, 200),
        status: "new" as const,
        score: Math.min(100, Math.max(0, l.score)),
        notes: `Role: ${l.role}\nAI Insight: ${l.reason}`,
        source: "ai_discovery",
      }));

    const { error: insertError, data: inserted } = await supabase.from("leads").insert(leadsToImport).select("id, name, email, company");

    if (insertError) {
      toast.error("Failed to import leads: " + insertError.message);
    } else {
      toast.success(`Imported ${leadsToImport.length} lead${leadsToImport.length > 1 ? "s" : ""}!`);
      setImported(true);
      onLeadsImported?.();

      // Trigger auto-outreach in background — only when the user opted in.
      if (outreachEnabled && inserted && inserted.length > 0) {
        triggerOutreach(inserted);
      }
    }
    setImporting(false);
  };

  const inputClass =
    "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="command" size="sm">
          <Wand2 className="h-4 w-4" />
          Auto-Find Leads
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Lead Discovery
          </DialogTitle>
          <DialogDescription>
            Describe your business and AI will suggest ideal leads to pursue.
          </DialogDescription>
        </DialogHeader>

        {imported ? (
          <div className="space-y-4 py-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="text-sm font-medium text-foreground">
              Leads imported successfully!
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => { reset(); }}>
                Find More
              </Button>
              <Button variant="command" size="sm" onClick={() => { setOpen(false); reset(); }}>
                Done
              </Button>
            </div>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                What does your business do? *
              </label>
              <textarea
                className="w-full rounded-lg border border-input bg-input p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={3}
                maxLength={5000}
                placeholder="e.g. We provide cloud-based accounting software for small and medium businesses..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Industry (optional)
                </label>
                <input
                  className={inputClass}
                  placeholder="e.g. SaaS, Healthcare, Real Estate"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Number of leads
                </label>
                <select
                  className={inputClass}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  <option value={5}>5 leads</option>
                  <option value={10}>10 leads</option>
                  <option value={15}>15 leads</option>
                  <option value={20}>20 leads</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <Button
              variant="command"
              className="w-full gap-2"
              onClick={handleFind}
              disabled={loading || description.length < 10}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Discovering leads...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Find Leads with AI
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Select all */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={selected.size === suggestions.length}
                  onCheckedChange={toggleAll}
                />
                Select all ({suggestions.length})
              </label>
              <Badge variant="info">{selected.size} selected</Badge>
            </div>

            {/* Lead list */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {suggestions.map((lead, i) => (
                <div
                  key={i}
                  onClick={() => toggleSelect(i)}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    selected.has(i)
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card hover:border-border/80"
                  }`}
                >
                  <Checkbox
                    checked={selected.has(i)}
                    onCheckedChange={() => toggleSelect(i)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {lead.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        Score: {lead.score}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{lead.company}</span>
                      <span className="mx-1">·</span>
                      <span className="truncate">{lead.role}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1">
                      {lead.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Auto-outreach toggle */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <label
                htmlFor="auto-outreach-find"
                className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI auto-outreach
                <span className="font-normal text-muted-foreground">
                  — email selected leads after import
                </span>
              </label>
              <Switch
                id="auto-outreach-find"
                checked={outreachEnabled}
                onCheckedChange={setOutreachEnabled}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={reset}>
                Start Over
              </Button>
              <Button
                variant="command"
                size="sm"
                onClick={handleImport}
                disabled={importing || selected.size === 0}
              >
                {importing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                )}
                Import {selected.size} Lead{selected.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
