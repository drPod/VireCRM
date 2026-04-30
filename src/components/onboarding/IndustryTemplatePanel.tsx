/**
 * Owner-only panel inside Settings that shows the active industry template
 * and lets the owner re-run the onboarding wizard (industry / theme /
 * privacy). Re-running is implemented by clearing
 * `organizations.onboarding_completed_at` — the gate in `_app.tsx` then
 * remounts the wizard on the next render.
 */
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { INDUSTRY_LIST, getTemplate } from "@/lib/industry-templates";

export function IndustryTemplatePanel() {
  const { organization, role, refreshProfile } = useAuth();
  const [resetting, setResetting] = useState(false);
  const isOwner = role?.role === "owner";

  if (!organization) return null;
  const active = getTemplate(organization.industry_template);

  const handleReset = async () => {
    if (!isOwner) return;
    if (!confirm("Re-run the setup wizard? Your team will see it on their next page load.")) return;
    setResetting(true);
    // Clear `enabled_modules` alongside `onboarding_completed_at` so the
    // wizard's chosen template re-seeds the module list cleanly. Otherwise
    // switching industries (e.g. Energy → Solar) would leave stale energy_*
    // module keys in the DB and the sidebar would show legacy items until
    // the next manual fix.
    const { error } = await supabase
      .from("organizations")
      .update({
        onboarding_completed_at: null,
        enabled_modules: null,
      } as never)
      .eq("id", organization.id);
    setResetting(false);
    if (error) {
      toast.error(`Could not reset: ${error.message}`);
      return;
    }
    toast.success("Wizard reopened. Refresh to see it.");
    await refreshProfile();
    // Hard reload so the gate in _app.tsx re-evaluates with the new org state.
    window.location.reload();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Industry Template
            </CardTitle>
            <CardDescription>
              Customizes terminology, sidebar modules, and pipeline stages.
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INDUSTRY_LIST.map((t) => {
            const isActive = t.key === active.key;
            return (
              <div
                key={t.key}
                className={`rounded-lg border p-2.5 text-xs ${
                  isActive ? "border-primary/60 bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="font-semibold text-foreground">{t.name}</div>
                <div className="text-muted-foreground truncate" title={t.tagline}>
                  {t.tagline}
                </div>
              </div>
            );
          })}
        </div>

        {isOwner ? (
          <Button onClick={handleReset} disabled={resetting} variant="outline">
            {resetting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Re-run setup wizard
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only the organization owner can change the industry template.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
