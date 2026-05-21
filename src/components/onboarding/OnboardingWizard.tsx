/**
 * Owner-only onboarding wizard. Shown the first time an owner lands inside
 * /_app on an org that hasn't completed onboarding yet
 * (organizations.onboarding_completed_at IS NULL).
 *
 * Two steps (industry step was dropped — energy is the only vertical, so it's
 * auto-applied on finish):
 *   1. Pick brand color (defaults to energy template primary, owner can override)
 *   2. Configure data privacy (strict lead isolation toggle)
 *
 * On finish we patch organizations with the energy template, color, modules,
 * privacy setting, and stamp onboarding_completed_at — which dismisses the
 * wizard for everyone in the org.
 *
 * Non-owners never see this UI. They just see a friendly "ask your owner to
 * finish setup" notice on first paint instead of a half-configured CRM.
 */
import { useState } from "react";
import { Loader2, Check, Palette, Shield } from "lucide-react";
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
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";

interface OnboardingWizardProps {
  organizationId: string;
  isOwner: boolean;
  onComplete: () => void;
  /** Prefill brand color on re-run. */
  currentBrandColor?: string | null;
  /** Prefill privacy toggle on re-run. */
  currentStrictIsolation?: boolean;
  /** Whether the non-owner notice has already been dismissed (persisted in DB). */
  noticeDismissed: boolean;
  /** Called when the non-owner dismisses the notice — caller persists to DB. */
  onDismissNotice: () => void;
}

// Energy is the only legal industry now. Wizard pulls theme + module defaults
// straight from this template and skips the picker step entirely.
const ENERGY_TEMPLATE = INDUSTRY_TEMPLATES.energy;

export function OnboardingWizard({
  organizationId,
  isOwner,
  onComplete,
  currentBrandColor,
  currentStrictIsolation,
  noticeDismissed,
  onDismissNotice,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [brandColor, setBrandColor] = useState<string>(
    currentBrandColor || ENERGY_TEMPLATE.theme.primary,
  );
  const [strictIsolation, setStrictIsolation] = useState(currentStrictIsolation ?? false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Non-owners get a dismissible heads-up — they can still use the CRM
  // while the owner finishes setup. Dismissal is persisted to profiles.wizard_notice_dismissed
  // so it survives page reloads and new sessions.
  const [noticeOpen, setNoticeOpen] = useState(!noticeDismissed);
  if (!isOwner) {
    return (
      <Dialog
        open={noticeOpen}
        onOpenChange={(open) => {
          setNoticeOpen(open);
          if (!open) {
            onDismissNotice();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Setup still in progress</DialogTitle>
            <DialogDescription>
              Your workspace owner hasn't finished the initial setup yet. You can keep using the CRM
              — some defaults (industry template, branding) may change once they complete it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => {
                setNoticeOpen(false);
                onDismissNotice();
              }}
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const hexColorValid = brandColor.length === 0 || /^#[0-9a-fA-F]{6}$/.test(brandColor);

  const handleFinish = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Owner stamps industry_template + enabled_modules along with theme,
      // privacy, and the completion stamp. The DB trigger
      // `guard_industry_template_change` permits owner-driven updates and
      // `log_template_change` audits them automatically.
      const patch: Record<string, unknown> = {
        industry_template: ENERGY_TEMPLATE.key,
        enabled_modules: ENERGY_TEMPLATE.defaultModules,
        primary_color: brandColor || ENERGY_TEMPLATE.theme.primary,
        accent_color: ENERGY_TEMPLATE.theme.accent,
        sidebar_color: ENERGY_TEMPLATE.theme.sidebar,
        strict_lead_isolation: strictIsolation,
        onboarding_completed_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("organizations")
        .update(patch as never)
        .eq("id", organizationId);

      if (error) throw error;
      toast.success(`${ENERGY_TEMPLATE.name} workspace ready`);
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save setup";
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 0 && <Palette className="h-5 w-5" />}
            {step === 1 && <Shield className="h-5 w-5" />}
            {step === 0 && "Pick your brand color"}
            {step === 1 && "Lead privacy"}
          </DialogTitle>
          <DialogDescription>Step {step + 1} of 2 — only owners see this setup.</DialogDescription>
        </DialogHeader>

        {/* Step 0 — color */}
        {step === 0 && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Default color for <strong>{ENERGY_TEMPLATE.name}</strong>. Override it to match your
              brand — applies to buttons, links, and the sidebar accent.
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-12 w-20 p-1 cursor-pointer"
              />
              <div className="flex-1">
                <Input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="font-mono"
                  placeholder="#3b82f6"
                />
                {brandColor.length > 0 && !hexColorValid && (
                  <p className="text-xs text-destructive mt-1">
                    Must be a valid hex color like #3b82f6
                  </p>
                )}
              </div>
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
            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!hexColorValid}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 1 — privacy */}
        {step === 1 && (
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
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary" /> Industry:{" "}
                  <strong className="text-foreground">{ENERGY_TEMPLATE.name}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary" /> Modules enabled:{" "}
                  <strong className="text-foreground">
                    {ENERGY_TEMPLATE.defaultModules.length}
                  </strong>
                </div>
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
              <Button variant="ghost" onClick={() => setStep(0)} disabled={saving}>
                Back
              </Button>
              <Button onClick={() => void handleFinish()} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Finish setup
              </Button>
            </div>
            {saveError && (
              <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                <span>Save failed — {saveError}</span>
                <Button size="sm" variant="outline" onClick={() => void handleFinish()}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
