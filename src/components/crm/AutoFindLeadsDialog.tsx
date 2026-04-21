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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Wand2,
  Loader2,
  UserPlus,
  Building2,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Settings as SettingsIcon,
  Crown,
  KeyRound,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  findLeadsFn,
  getLeadUsageFn,
  type SuggestedLead,
  type LeadUsage,
} from "@/functions/find-leads.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAutoOutreach } from "@/hooks/useAutoOutreach";
import { useAutoOutreachPreference } from "@/hooks/useAutoOutreachPreference";
import { toast } from "sonner";

const INDUSTRY_PRESETS = [
  "SaaS",
  "E-commerce",
  "Real Estate",
  "Healthcare",
  "Agency",
  "Local Services",
] as const;

const PERSONA_PRESETS = [
  "Founder/CEO",
  "Head of Sales",
  "Marketing Lead",
  "Operations",
] as const;

interface AutoFindLeadsDialogProps {
  onLeadsImported?: () => void;
}

type ErrorCode = "INTEGRATION_MISSING" | "QUOTA_EXCEEDED" | "PLATFORM_KEY_MISSING" | null;

// Parse "[CODE] message::{json}" sentinel format from server fn errors.
function parseServerError(msg: string): { code: ErrorCode; clean: string } {
  const m = msg.match(/^\[(INTEGRATION_MISSING|QUOTA_EXCEEDED|PLATFORM_KEY_MISSING)\]\s*([\s\S]*?)(?:::(\{[\s\S]*\}))?$/);
  if (!m) return { code: null, clean: msg };
  return { code: m[1] as ErrorCode, clean: m[2] };
}

export function AutoFindLeadsDialog({ onLeadsImported }: AutoFindLeadsDialogProps) {
  const { organization, role } = useAuth();
  const isOwner = role?.role === "owner";
  const { triggerOutreach } = useAutoOutreach();
  const { enabled: outreachEnabled, setEnabled: setOutreachEnabled } = useAutoOutreachPreference();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryChoice, setIndustryChoice] = useState<string>("");
  const [persona, setPersona] = useState<string>("");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ErrorCode>(null);
  const [imported, setImported] = useState(false);
  const [usage, setUsage] = useState<LeadUsage | null>(null);

  const findLeads = useAuthedServerFn(findLeadsFn);
  const getLeadUsage = useAuthedServerFn(getLeadUsageFn);

  const refreshUsage = useCallback(async () => {
    if (!organization?.id) return;
    try {
      const u = await getLeadUsage({ data: { organizationId: organization.id } });
      setUsage(u);
    } catch (err) {
      console.warn("Failed to load lead usage", err);
    }
  }, [organization?.id, getLeadUsage]);

  useEffect(() => {
    if (open) void refreshUsage();
  }, [open, refreshUsage]);

  const reset = useCallback(() => {
    setSuggestions([]);
    setSelected(new Set());
    setError(null);
    setErrorCode(null);
    setImported(false);
  }, []);

  const handleFind = async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setSuggestions([]);

    try {
      const trimmed = description.trim();
      const result = await findLeads({
        data: {
          organizationId: organization.id,
          businessDescription: trimmed.length >= 10 ? trimmed : undefined,
          industry: industry || undefined,
          persona: persona || undefined,
          count,
        },
      });
      setSuggestions(result.leads);
      setSelected(new Set(result.leads.map((_, i) => i)));
      void refreshUsage();
      if (result.leads.length === 0) {
        setError(
          "Apollo found matches but none had a verified email. Try broadening your filters (e.g. drop the persona or pick a wider industry).",
        );
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Failed to find leads";
      const { code, clean } = parseServerError(raw);
      setError(clean);
      setErrorCode(code);
      void refreshUsage();
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

      if (outreachEnabled && inserted && inserted.length > 0) {
        triggerOutreach(inserted);
      }
    }
    setImporting(false);
  };

  const inputClass =
    "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

  // Quota progress percentage. Hidden when org has BYO key or unlimited.
  const quotaPct =
    usage && usage.quota > 0 ? Math.min(100, Math.round((usage.used / usage.quota) * 100)) : 0;
  const showQuotaBar = !!(usage && !usage.hasByoKey && usage.quota < 999999);
  const isAtCap = errorCode === "QUOTA_EXCEEDED";

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
            Find Real Leads
          </DialogTitle>
          <DialogDescription>
            Verified B2B contacts from Apollo's 275M+ database.
          </DialogDescription>
        </DialogHeader>

        {/* Quota / BYO status banner */}
        {!imported && !isAtCap && showQuotaBar && (
          <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Monthly lead credits
              </div>
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{usage!.used}</span> / {usage!.quota}
              </span>
            </div>
            <Progress value={quotaPct} className="h-1.5" />
            {usage!.remaining < 10 && usage!.remaining > 0 && (
              <p className="text-[11px] text-warning">
                Only {usage!.remaining} credits left — they reset on the 1st.
              </p>
            )}
          </div>
        )}
        {!imported && !isAtCap && usage?.hasByoKey && (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs">
            <KeyRound className="h-3.5 w-3.5 text-success" />
            <span className="text-foreground font-medium">Using your own Apollo key</span>
            <span className="text-muted-foreground">— unlimited, billed by Apollo</span>
          </div>
        )}

        {/* QUOTA EXCEEDED — replace whole content with upgrade prompt */}
        {isAtCap ? (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="rounded-full bg-warning/10 p-3">
                <Crown className="h-6 w-6 text-warning" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                You've hit your monthly cap
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {error}
              </p>
            </div>
            <div className="grid gap-2 pt-2">
              <Link to="/billing" onClick={() => setOpen(false)}>
                <Button variant="command" className="w-full gap-2">
                  <Crown className="h-4 w-4" />
                  Upgrade plan for more credits
                </Button>
              </Link>
              {isOwner && (
                <Link to="/settings" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full gap-2">
                    <KeyRound className="h-4 w-4" />
                    Use my own Apollo key (unlimited)
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={reset}>
                Back
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Credits reset on the 1st of every month.
            </p>
          </div>
        ) : imported ? (
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
                What does your business do? <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                className="w-full rounded-lg border border-input bg-input p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={3}
                maxLength={5000}
                placeholder="Leave blank for generic B2B leads, or describe your business for tailored results — e.g. cloud accounting software for SMBs."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Industry (optional)
                </label>
                <select
                  className={inputClass}
                  value={industryChoice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setIndustryChoice(v);
                    if (v === "__custom__") {
                      setIndustry("");
                    } else {
                      setIndustry(v);
                    }
                  }}
                >
                  <option value="">Any industry</option>
                  {INDUSTRY_PRESETS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="__custom__">Other (type your own)…</option>
                </select>
                {industryChoice === "__custom__" && (
                  <input
                    className={`${inputClass} mt-2`}
                    placeholder="e.g. Construction, Education, Logistics"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    maxLength={200}
                    autoFocus
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Lead persona (optional)
                </label>
                <select
                  className={inputClass}
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                >
                  <option value="">Any role</option>
                  {PERSONA_PRESETS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
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
                {showQuotaBar && count > usage!.remaining && usage!.remaining > 0 && (
                  <p className="mt-1 text-[11px] text-warning">
                    Only {usage!.remaining} credits left this month — pick a smaller batch or upgrade.
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
                {(errorCode === "INTEGRATION_MISSING" || errorCode === "PLATFORM_KEY_MISSING") && isOwner && (
                  <Link
                    to="/settings"
                    onClick={() => setOpen(false)}
                    className="ml-6 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <SettingsIcon className="h-3 w-3" />
                    Open Settings → Integrations
                  </Link>
                )}
              </div>
            )}

            <Button
              variant="command"
              className="w-full gap-2"
              onClick={handleFind}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Discovering leads...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Find Leads
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
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
