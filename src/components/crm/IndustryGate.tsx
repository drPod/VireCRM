/**
 * IndustryGate — presentational gate for vertical CRM routes.
 *
 * The sidebar already hides vertical sections when the org's
 * `industry_template` doesn't match. But routes themselves render full
 * (Energy / Solar / Real Estate / Insurance / Gym) regardless, so deep
 * links and stale bookmarks leak vertical-specific UI to workspaces on
 * a different template.
 *
 * Wrap each vertical route component with `<IndustryGate industry="energy">…`
 * to short-circuit the render and show a graceful empty state instead of
 * a hard redirect. Loaders and head meta are untouched on purpose.
 */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getTemplate,
  INDUSTRY_TEMPLATES,
  type IndustryKey,
} from "@/lib/industry-templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IndustryGateProps {
  industry: IndustryKey;
  children: ReactNode;
}

export function IndustryGate({ industry, children }: IndustryGateProps) {
  const { organization, loading } = useAuth();

  // While the auth context is hydrating we can't know the org's industry
  // yet. Render nothing rather than flashing the empty state — the parent
  // `_app` layout already handles its own loading shell.
  if (loading) return null;

  const orgIndustry = organization?.industry_template ?? "general";
  if (orgIndustry === industry) return <>{children}</>;

  const gateTemplate = INDUSTRY_TEMPLATES[industry];
  const activeTemplate = getTemplate(orgIndustry);

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">
              {gateTemplate.name} — not enabled for this workspace
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This workspace is set to <strong>{activeTemplate.name}</strong>{" "}
            industry. {gateTemplate.name}-specific modules only appear for
            workspaces using the {gateTemplate.name} template. Ask your
            platform admin to switch the industry.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link to="/dashboard">
              <Button variant="secondary" size="sm">
                Go to dashboard
              </Button>
            </Link>
            <Link
              to="/admin"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Contact platform admin
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
