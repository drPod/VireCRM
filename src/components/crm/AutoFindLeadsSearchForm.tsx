import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Crown,
  KeyRound,
  Loader2,
  Settings as SettingsIcon,
  Wand2,
} from "lucide-react";
import {
  INDUSTRY_PRESETS,
  PERSONA_PRESETS,
} from "@/lib/auto-find-leads-helpers";
import type {
  AutoFindProvider,
  UseAutoFindLeadsReturn,
} from "@/hooks/useAutoFindLeads";

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

interface AutoFindLeadsSearchFormProps {
  flow: UseAutoFindLeadsReturn;
  isOwner: boolean;
  onCloseDialog: () => void;
}

export function AutoFindLeadsSearchForm({
  flow,
  isOwner,
  onCloseDialog,
}: AutoFindLeadsSearchFormProps) {
  const {
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
    loading,
    error,
    errorCode,
    usage,
    showQuotaBar,
    wouldExceedCap,
    handleFind,
  } = flow;

  return (
    <div className="space-y-4 pt-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Lead source</label>
        <select
          className={inputClass}
          value={provider}
          onChange={(e) => setProvider(e.target.value as AutoFindProvider)}
        >
          <option value="apollo">Apollo.io — search by title/industry (1 credit per lead)</option>
          <option value="hunter">Hunter.io — emails by company domain (cheap)</option>
          <option value="snov">Snov.io — emails by company domain (cheapest)</option>
        </select>
        {(provider === "hunter" || provider === "snov") && (
          <input
            className={`${inputClass} mt-2 font-mono`}
            placeholder="Company domain — e.g. stripe.com"
            value={companyDomain}
            onChange={(e) => setCompanyDomain(e.target.value)}
            maxLength={253}
          />
        )}
      </div>
      {provider === "apollo" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            What does your business do?{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
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
      )}
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
              <option key={opt} value={opt}>
                {opt}
              </option>
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
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground">Number of leads</label>
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
          {showQuotaBar && wouldExceedCap && usage!.remaining > 0 && (
            <p className="mt-1 text-[11px] text-warning">
              Only {usage!.remaining} credit{usage!.remaining === 1 ? "" : "s"} left this month —
              pick a smaller batch or upgrade.
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
          {(errorCode === "INTEGRATION_MISSING" || errorCode === "PLATFORM_KEY_MISSING") &&
            isOwner && (
              <Link
                to="/settings"
                onClick={onCloseDialog}
                className="ml-6 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <SettingsIcon className="h-3 w-3" />
                Open Settings → Integrations
              </Link>
            )}
        </div>
      )}

      {/* Hard pre-flight block — request would exceed remaining credits. */}
      {wouldExceedCap && usage!.remaining > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2.5">
          <div className="flex items-start gap-2 text-xs text-foreground">
            <Crown className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                This search needs {count} credits — you only have {usage!.remaining} left.
              </p>
              <p className="text-muted-foreground mt-0.5">
                Drop the batch size, upgrade your plan
                {isOwner ? ", or connect your own Apollo key" : ""}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="command" size="sm" className="gap-1.5" asChild>
              <Link to="/pricing" onClick={onCloseDialog}>
                <Crown className="h-3.5 w-3.5" />
                Upgrade plan
              </Link>
            </Button>
            {isOwner && (
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to="/settings" onClick={onCloseDialog}>
                  <KeyRound className="h-3.5 w-3.5" />
                  Use my Apollo key
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <Button
        variant="command"
        className="w-full gap-2"
        onClick={handleFind}
        disabled={loading || wouldExceedCap}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Discovering leads...
          </>
        ) : wouldExceedCap ? (
          <>
            <Crown className="h-4 w-4" />
            Upgrade to search for {count} leads
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Find Leads
          </>
        )}
      </Button>
    </div>
  );
}
