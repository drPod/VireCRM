/**
 * Owner-only onboarding wizard. Shown the first time an owner lands inside
 * /_app on an org that hasn't completed onboarding yet
 * (organizations.onboarding_completed_at IS NULL).
 *
 * Three steps:
 *   1. Pick industry template — drives terminology, default modules, theme
 *   2. Pick brand color (defaults to template primary, owner can override)
 *   3. Configure data privacy (strict lead isolation toggle)
 *
 * On finish we patch organizations with the chosen template, color, modules,
 * privacy setting, and stamp onboarding_completed_at — which dismisses the
 * wizard for everyone in the org.
 *
 * Non-owners never see this UI. They just see a friendly "ask your owner to
 * finish setup" notice on first paint instead of a half-configured CRM.
 */
import { useState } from "react";
import { Loader2, Check, ChevronRight, Building2, Palette, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { INDUSTRY_LIST, type IndustryKey, type IndustryTemplate } from "@/lib/industry-templates";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

interface OnboardingWizardProps {
  organizationId: string;
  isOwner: boolean;
  onComplete: () => void;
  /** Prefill industry on re-run so owners aren't dropped at zero. */
  currentIndustry?: IndustryKey | null;
  /** Prefill brand color on re-run. */
  currentBrandColor?: string | null;
  /** Prefill privacy toggle on re-run. */
  currentStrictIsolation?: boolean;
}

export function OnboardingWizard({
  organizationId,
  isOwner,
  onComplete,
  currentIndustry,
  currentBrandColor,
  currentStrictIsolation,
}: OnboardingWizardProps) {
  const { isAdmin: isPlatformAdmin } = usePlatformAdmin();
  // Non-platform-admins never get to pick a template. They start on "general"
  // (the safe default) and the platform admin assigns the real template later
  // from /admin. The DB trigger `guard_industry_template_change` enforces this
  // server-side too, so even a crafted client request is rejected.
  const lockedTemplate = !isPlatformAdmin;
  const defaultKey: IndustryKey = (currentIndustry ?? "general") as IndustryKey;
  const initialTemplate = lockedTemplate
    ? (INDUSTRY_LIST.find((t) => t.key === defaultKey) ??
      INDUSTRY_LIST.find((t) => t.key === "general") ??
      null)
    : currentIndustry
      ? (INDUSTRY_LIST.find((t) => t.key === currentIndustry) ?? null)
      : null;
  const [step, setStep] = useState(lockedTemplate ? 1 : 0);
  const [industry, setIndustry] = useState<IndustryKey | null>(
    lockedTemplate ? (initialTemplate?.key ?? "general") : (currentIndustry ?? null),
  );
  const [brandColor, setBrandColor] = useState<string>(
    currentBrandColor || initialTemplate?.theme.primary || "",
  );
  const [strictIsolation, setStrictIsolation] = useState(currentStrictIsolation ?? false);
  const [saving, setSaving] = useState(false);

  // Non-owners get a dismissible heads-up — they can still use the CRM
  // while the owner finishes setup. We track dismissal in sessionStorage so
  // it doesn't reappear on every navigation within the same session.
  const dismissKey = `genesis:onboarding-notice-dismissed:${organizationId}`;
  const [noticeOpen, setNoticeOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem(dismissKey) !== "1";
  });
  if (!isOwner) {
    return (
      <Dialog
        open={noticeOpen}
        onOpenChange={(open) => {
          setNoticeOpen(open);
          if (!open && typeof window !== "undefined") {
            window.sessionStorage.setItem(dismissKey, "1");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Setup still in progress</DialogTitle>
            <DialogDescription>
              Your workspace owner hasn’t finished the initial setup yet. You can keep using the CRM
              — some defaults (industry template, branding) may change once they complete it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => {
                setNoticeOpen(false);
                if (typeof window !== "undefined") {
                  window.sessionStorage.setItem(dismissKey, "1");
                }
              }}
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const selectedTemplate: IndustryTemplate | null = industry
    ? (INDUSTRY_LIST.find((t) => t.key === industry) ?? null)
    : null;

  const handleSelectIndustry = (key: IndustryKey) => {
    const tmpl = INDUSTRY_LIST.find((t) => t.key === key);
    setIndustry(key);
    if (tmpl) setBrandColor(tmpl.theme.primary);
    setStep(1);
  };

  const handleFinish = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      // Non-platform-admins can't touch industry_template or enabled_modules —
      // the DB trigger would reject it anyway. They get color + privacy + a
      // completion stamp; the platform admin assigns the real template later.
      const patch: Record<string, unknown> = {
        primary_color: brandColor || selectedTemplate.theme.primary,
        accent_color: selectedTemplate.theme.accent,
        sidebar_color: selectedTemplate.theme.sidebar,
        strict_lead_isolation: strictIsolation,
        onboarding_completed_at: new Date().toISOString(),
      };
      if (!lockedTemplate) {
        patch.industry_template = selectedTemplate.key;
        patch.enabled_modules = selectedTemplate.defaultModules;
      }
      const { error } = await supabase
        .from("organizations")
        .update(patch as never)
        .eq("id", organizationId);

      if (error) throw error;
      toast.success(
        lockedTemplate ? "Workspace ready" : `${selectedTemplate.name} workspace ready`,
      );
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save setup");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 0 && <Building2 className="h-5 w-5" />}
            {step === 1 && <Palette className="h-5 w-5" />}
            {step === 2 && <Shield className="h-5 w-5" />}
            {step === 0 && "Pick your industry"}
            {step === 1 && "Pick your brand color"}
            {step === 2 && "Lead privacy"}
          </DialogTitle>
          <DialogDescription>
            Step {lockedTemplate ? step : step + 1} of {lockedTemplate ? 2 : 3} — only owners see
            this setup.
          </DialogDescription>
        </DialogHeader>

        {/* Step 0 — industry template (platform admin only) */}
        {step === 0 && !lockedTemplate && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {INDUSTRY_LIST.map((tmpl) => (
              <button
                key={tmpl.key}
                onClick={() => handleSelectIndustry(tmpl.key)}
                className="text-left rounded-lg border border-border bg-card hover:bg-accent/30 p-4 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="h-8 w-8 rounded-md flex-shrink-0 ring-1 ring-border/50"
                    style={{
                      background: `linear-gradient(135deg, ${tmpl.theme.primary}, ${tmpl.theme.accent})`,
                    }}
                  />
                  <div>
                    <h3 className="font-semibold text-foreground">{tmpl.name}</h3>
                    <p className="text-xs text-muted-foreground">{tmpl.tagline}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{tmpl.description}</p>
                <div className="mt-3 flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition">
                  Use this template <ChevronRight className="h-3 w-3 ml-1" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 1 — color */}
        {step === 1 && selectedTemplate && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              {lockedTemplate ? (
                <>Pick your brand color — applies to buttons, links, and the sidebar accent.</>
              ) : (
                <>
                  Default color for <strong>{selectedTemplate.name}</strong>. Override it to match
                  your brand — applies to buttons, links, and the sidebar accent.
                </>
              )}
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-12 w-20 p-1 cursor-pointer"
              />
              <Input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="font-mono"
                placeholder="#3b82f6"
              />
            </div>
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Preview</p>
              <Button
                style={{ backgroundColor: brandColor, color: "#fff" }}
                className="hover:opacity-90"
              >
                Sample button
              </Button>
            </div>
            <div className="flex justify-between">
              {lockedTemplate ? (
                <span />
              ) : (
                <Button variant="ghost" onClick={() => setStep(0)}>
                  Back
                </Button>
              )}
              <Button onClick={() => setStep(2)}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step 2 — privacy */}
        {step === 2 && selectedTemplate && (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="strict-toggle" className="text-base font-semibold">
                    Strict lead isolation
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    When ON, sales reps only see leads they own, are assigned to, or were explicitly
                    shared with. Owners and managers always see everything in the org.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    When OFF, all org members can see every lead in the workspace (current default).
                  </p>
                </div>
                <Switch
                  id="strict-toggle"
                  checked={strictIsolation}
                  onCheckedChange={setStrictIsolation}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 bg-card space-y-2">
              <p className="text-sm font-semibold text-foreground">Setup summary</p>
              <div className="text-sm text-muted-foreground space-y-1">
                {!lockedTemplate && (
                  <>
                    <div className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-primary" /> Industry:{" "}
                      <strong className="text-foreground">{selectedTemplate.name}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-primary" /> Modules enabled:{" "}
                      <strong className="text-foreground">
                        {selectedTemplate.defaultModules.length}
                      </strong>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary" /> Brand color:{" "}
                  <span className="font-mono text-foreground">{brandColor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary" /> Lead privacy:{" "}
                  <strong className="text-foreground">
                    {strictIsolation ? "Strict (per-user)" : "Shared (org-wide)"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
                Back
              </Button>
              <Button onClick={handleFinish} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Finish setup
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
