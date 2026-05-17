/**
 * Owner-facing industry template picker for /settings.
 *
 * Lets the org owner switch industry template post-onboarding. Wraps a Select
 * + confirmation modal because the change reseeds `enabled_modules` (the DB
 * trigger `sync_enabled_modules_on_industry_change` swaps in the new
 * template's defaults) and reshapes the sidebar — not destructive, but loud
 * enough to warrant a confirm step.
 *
 * The change goes straight through to `organizations.industry_template`. The
 * DB trigger `guard_industry_template_change` permits owner writes, and the
 * AFTER trigger `log_template_change` audits the change into
 * `template_assignment_audit_log` automatically — no client-side logging.
 *
 * Non-owners see a read-only card; platform admin assignment still flows
 * through `/admin` and `admin_set_org_industry` RPC (untouched here).
 */
import { useState } from "react";
import { Loader2, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDUSTRY_LIST, getTemplate, type IndustryKey } from "@/lib/industry-templates";

export function IndustryTemplatePicker() {
  const { organization, role, refreshProfile } = useAuth();
  const isOwner = role?.role === "owner";
  const active = getTemplate(organization?.industry_template);

  const [pending, setPending] = useState<IndustryKey | null>(null);
  const [saving, setSaving] = useState(false);

  if (!organization) return null;

  const handleConfirm = async () => {
    if (!pending) return;
    const target = INDUSTRY_LIST.find((t) => t.key === pending);
    if (!target) return;
    setSaving(true);
    try {
      // Set industry_template alongside the template's theme + module
      // defaults. The DB trigger would resync `enabled_modules` from NULL,
      // but writing them explicitly keeps the client cache + Supabase write
      // path consistent (and the trigger no-ops when both NEW + OLD match).
      const { error } = await supabase
        .from("organizations")
        .update({
          industry_template: target.key,
          enabled_modules: target.defaultModules,
          primary_color: target.theme.primary,
          accent_color: target.theme.accent,
          sidebar_color: target.theme.sidebar,
        } as never)
        .eq("id", organization.id);

      if (error) throw error;
      toast.success(`Industry switched to ${target.name}`);
      setPending(null);
      await refreshProfile();
      // Sidebar + theme variables read from auth context; force a fresh paint
      // so verticals re-render against the new template immediately.
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change industry template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="industry">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Industry template
            </CardTitle>
            <CardDescription>
              Drives sidebar verticals, pipeline stages, and terminology. Switch anytime —
              your data stays put.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            Active: {active.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
          <p className="text-sm font-medium text-foreground">{active.name}</p>
          <p className="text-xs text-muted-foreground">{active.tagline}</p>
          <p className="text-xs text-muted-foreground mt-1">{active.description}</p>
        </div>

        {isOwner ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground" htmlFor="industry-select">
              Change template
            </label>
            <Select
              value={active.key}
              onValueChange={(v) => {
                if (v !== active.key) setPending(v as IndustryKey);
              }}
              disabled={saving}
            >
              <SelectTrigger id="industry-select" className="w-full sm:w-80">
                <SelectValue placeholder="Pick an industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_LIST.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.name} — <span className="text-muted-foreground">{t.tagline}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Switching reseeds sidebar modules + theme colors for the new template. Stages and
              terminology update on next page load.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Only the organization owner can change the industry template.
            </p>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Switch to {pending ? getTemplate(pending).name : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The sidebar will show {pending ? getTemplate(pending).name : ""}-specific modules and
              relabel "Leads" using that industry's terminology. Theme colors reset to the new
              template's defaults — re-apply your custom branding from the White-Label tab if
              needed. Your existing leads, deals, and data are untouched. The change is audited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Switch template
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
