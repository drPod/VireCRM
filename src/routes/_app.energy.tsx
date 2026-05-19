/**
 * Energy CRM hub — visible to all org members but is the natural landing
 * page for orgs that picked the Energy template in onboarding.
 *
 * Each module card shows live row counts pulled with RLS-respecting client
 * queries, so the numbers automatically reflect what each user is actually
 * allowed to see (vs. what's in the org).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileText,
  Gauge,
  DollarSign,
  FileSignature,
  Building2,
  RefreshCw,
  Loader2,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { getTemplate } from "@/lib/industry-templates";
import { IndustryGate } from "@/components/crm/IndustryGate";

export const Route = createFileRoute("/_app/energy")({
  component: () => (
    <IndustryGate industry="energy">
      <EnergyHub />
    </IndustryGate>
  ),
  head: () => ({
    meta: [{ title: "Energy CRM — VireCRM" }],
  }),
});

const MODULES = [
  {
    key: "loa_requests",
    label: "LOA Requests",
    icon: FileText,
    table: "loa_requests" as const,
    hint: "Letter of Authorization tracking",
    to: "/energy/loa",
  },
  {
    key: "usage_requests",
    label: "Usage Requests",
    icon: Gauge,
    table: "usage_requests" as const,
    hint: "Utility usage data pulls",
    to: "/energy/usage",
  },
  {
    key: "pricing_requests",
    label: "Pricing Requests",
    icon: DollarSign,
    table: "pricing_requests" as const,
    hint: "Supplier pricing comparisons",
    to: "/energy/pricing",
  },
  {
    key: "contract_requests",
    label: "Contract Requests",
    icon: FileSignature,
    table: "contract_requests" as const,
    hint: "Contract submission pipeline",
    to: "/energy/contracts",
  },
  {
    key: "energy_suppliers",
    label: "Suppliers",
    icon: Building2,
    table: "energy_suppliers" as const,
    hint: "Supplier directory & terms",
    to: "/energy/suppliers",
  },
  {
    key: "renewals",
    label: "Renewals",
    icon: RefreshCw,
    table: "renewals" as const,
    hint: "Upcoming renewal opportunities",
    to: "/energy/renewals",
  },
  {
    key: "energy_customers",
    label: "Active Customers",
    icon: Users,
    table: "energy_customers" as const,
    hint: "Currently enrolled customers & contract terms",
    to: "/energy/customers",
  },
];

function EnergyHub() {
  const { organization } = useAuth();
  const template = getTemplate(organization?.industry_template);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const results = await Promise.all(
        MODULES.map(async (m) => {
          const { count } = await supabase
            .from(m.table)
            .select("id", { count: "exact", head: true });
          return [m.key, count ?? 0] as const;
        }),
      );
      if (!cancelled) {
        setCounts(Object.fromEntries(results));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-foreground">Energy CRM</h1>
          {template.key === "energy" && (
            <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20">
              {template.name}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          {template.tagline}. Pipeline: {template.pipelineStages.slice(0, 4).join(" → ")} → …
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const count = counts[m.key];
          return (
            <Link key={m.key} to={m.to} className="block">
              <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {m.label}
                  </CardTitle>
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="text-2xl font-bold text-foreground">{count ?? 0}</span>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{m.hint}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Energy pipeline stages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {template.pipelineStages.map((stage) => (
              <Badge key={stage} variant="outline" className="border-border">
                {stage}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
