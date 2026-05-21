import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAutoOutreach } from "@/hooks/useAutoOutreach";
import { supabase } from "@/integrations/supabase/client";
import {
  findLeadsFn,
  getLeadUsageFn,
  recordLeadImportFn,
  type SuggestedLead,
  type LeadUsage,
} from "@/functions/find-leads.functions";
import {
  parseServerError,
  type AutoFindErrorCode,
} from "@/lib/auto-find-leads-helpers";

export type AutoFindProvider = "apollo" | "hunter" | "snov";

export type UseAutoFindLeadsReturn = ReturnType<typeof useAutoFindLeads>;

interface UseAutoFindLeadsOptions {
  open: boolean;
  initialDescription?: string;
  initialIndustry?: string;
  outreachEnabled: boolean;
  onLeadsImported?: () => void;
}

export function useAutoFindLeads({
  open,
  initialDescription,
  initialIndustry,
  outreachEnabled,
  onLeadsImported,
}: UseAutoFindLeadsOptions) {
  const { organization, user } = useAuth();
  const { triggerOutreach } = useAutoOutreach();

  const [provider, setProvider] = useState<AutoFindProvider>("apollo");
  const [companyDomain, setCompanyDomain] = useState("");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [industry, setIndustry] = useState(initialIndustry ?? "");
  const [industryChoice, setIndustryChoice] = useState<string>("");
  const [persona, setPersona] = useState<string>("");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AutoFindErrorCode>(null);
  const [quotaResetAt, setQuotaResetAt] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const [usage, setUsage] = useState<LeadUsage | null>(null);

  const findLeads = useServerFn(findLeadsFn);
  const getLeadUsage = useServerFn(getLeadUsageFn);
  const recordImport = useServerFn(recordLeadImportFn);

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
    setQuotaResetAt(null);
    setImported(false);
  }, []);

  const handleFind = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setQuotaResetAt(null);
    setSuggestions([]);

    try {
      const trimmed = description.trim();
      const result = await findLeads({
        data: {
          organizationId: organization.id,
          provider,
          businessDescription: trimmed.length >= 10 ? trimmed : undefined,
          industry: industry || undefined,
          persona: persona || undefined,
          companyDomain: companyDomain.trim() || undefined,
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
      const { code, clean, meta } = parseServerError(raw);
      setError(clean);
      setErrorCode(code);
      if (code === "QUOTA_EXCEEDED" && meta?.periodEnd) {
        setQuotaResetAt(meta.periodEnd);
      }
      void refreshUsage();
    } finally {
      setLoading(false);
    }
  }, [
    organization?.id,
    description,
    findLeads,
    provider,
    industry,
    persona,
    companyDomain,
    count,
    refreshUsage,
  ]);

  const toggleSelect = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === suggestions.length ? new Set() : new Set(suggestions.map((_, i) => i)),
    );
  }, [suggestions]);

  const handleImport = useCallback(async () => {
    if (!organization?.id || selected.size === 0) return;
    if (!user?.id) {
      toast.error("Please wait for your account to finish loading, then try again");
      return;
    }
    setImporting(true);
    const importStartedAt = Date.now();

    const leadsToImport = suggestions
      .filter((_, i) => selected.has(i))
      .map((l) => ({
        organization_id: organization.id,
        created_by: user.id,
        name: l.name.slice(0, 200),
        email: l.email.slice(0, 255),
        phone: l.phone?.slice(0, 50) || null,
        company: l.company.slice(0, 200),
        status: "new" as const,
        score: Math.min(100, Math.max(0, l.score)),
        notes: `Role: ${l.role}\nVerified by: ${l.reason}`,
        // Tag with the actual integration provider so auto-outreach knows
        // these came from a real data source (Apollo / Hunter / Snov), not
        // an AI guess or a manual entry.
        source: provider,
      }));

    const { error: insertError, data: inserted } = await supabase
      .from("leads")
      .insert(leadsToImport)
      .select("id, name, email, company, source");

    // Record the import outcome to the sync log (best-effort, non-blocking).
    void recordImport({
      data: {
        organizationId: organization.id,
        provider,
        fetched: leadsToImport.length,
        inserted: inserted?.length ?? 0,
        duplicates: 0,
        durationMs: Date.now() - importStartedAt,
        errorMessage: insertError?.message?.slice(0, 500),
      },
    }).catch((err) => console.warn("Failed to record sync log", err));

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
  }, [
    organization?.id,
    selected,
    user?.id,
    suggestions,
    provider,
    recordImport,
    onLeadsImported,
    outreachEnabled,
    triggerOutreach,
  ]);

  // Quota progress percentage. Hidden when org has BYO key or unlimited.
  const quotaPct =
    usage && usage.quota > 0 ? Math.min(100, Math.round((usage.used / usage.quota) * 100)) : 0;
  const showQuotaBar = !!(usage && !usage.hasByoKey && usage.quota < 999999);
  // Pre-flight cap detection — block the API call before it even fires.
  const outOfCredits = !!(
    usage &&
    !usage.hasByoKey &&
    usage.quota < 999999 &&
    usage.remaining <= 0
  );
  const wouldExceedCap = !!(
    usage &&
    !usage.hasByoKey &&
    usage.quota < 999999 &&
    count > usage.remaining
  );

  return {
    // form state
    provider,
    setProvider,
    companyDomain,
    setCompanyDomain,
    description,
    setDescription,
    industry,
    setIndustry,
    industryChoice,
    setIndustryChoice,
    persona,
    setPersona,
    count,
    setCount,
    // results state
    suggestions,
    selected,
    loading,
    importing,
    imported,
    // error / quota state
    error,
    errorCode,
    quotaResetAt,
    usage,
    quotaPct,
    showQuotaBar,
    outOfCredits,
    wouldExceedCap,
    // actions
    handleFind,
    handleImport,
    toggleSelect,
    toggleAll,
    reset,
  };
}
