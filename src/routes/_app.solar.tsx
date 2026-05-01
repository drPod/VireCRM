/**
 * Lightweight industry hub — shows the active template's pipeline stages
 * and lead counts per stage. Used for Solar / Real Estate / Insurance until
 * each gets its own deep workflow modules like Energy.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { getTemplate, type IndustryKey } from "@/lib/industry-templates";
import { bucketLeadsByStage } from "@/lib/pipeline-counts";
import { Button } from "@/components/ui/button";

export interface IndustryHubProps {
  industry: IndustryKey;
}

export function IndustryHub({ industry }: IndustryHubProps) {
  const { organization } = useAuth();
  const template = getTemplate(industry);
  const isActive = organization?.industry_template === industry;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [unmapped, setUnmapped] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!organization?.id) return;
    setLoading(true);
    void (async () => {
      // Pull only this org's leads + statuses, then bucket client-side. This
      // fixes two earlier bugs:
      //  1. ilike("status","%new lead%") matched any status containing "new",
      //     so "New Lead" and a custom "Newest" both incremented the same row.
      //  2. The query wasn't scoped to the active organization, so org-wide
      //     RLS-permitted reads inflated the numbers.
      const { data, error } = await supabase
        .from("leads")
        .select("status")
        .eq("organization_id", organization.id);
      if (cancelled) return;
      if (error) {
        setCounts({});
        setUnmapped(0);
        setLoading(false);
        return;
      }
      const { counts: next, unmapped: other } = bucketLeadsByStage(
        data ?? [],
        template.pipelineStages,
      );
      setCounts(next);
      setUnmapped(other);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [industry, organization?.id, template.pipelineStages]);


  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-foreground">{template.name}</h1>
            {isActive && <Badge variant="secondary">Active template</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{template.tagline}</p>
        </div>
        <Link to="/leads"><Button size="sm" variant="outline">Open {template.terminology.leadPlural}</Button></Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Pipeline stages</span>
            {!loading && unmapped > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {unmapped} lead{unmapped === 1 ? "" : "s"} on a custom status
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {template.pipelineStages.map((stage) => (
                <div key={stage} className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{stage}</div>
                  <div className="text-xl font-bold text-foreground mt-1">{counts[stage] ?? 0}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle className="text-base">Default modules</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {template.defaultModules.map((m) => (
              <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/solar")({
  component: () => <IndustryHub industry="solar" />,
});
