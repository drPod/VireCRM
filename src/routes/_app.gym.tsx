/**
 * Gym vertical dashboard — at-risk member list + goal tracking.
 * Risk score is whatever's stored in member_health.risk_score (0-100).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Target, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/gym")({
  component: GymDashboard,
});

interface Health {
  id: string;
  lead_id: string;
  last_visit_at: string | null;
  visits_last_30: number;
  visits_prior_30: number;
  engagement_score: number;
  risk_score: number;
  goal: string | null;
  goal_target: number | null;
  goal_current: number | null;
  goal_unit: string | null;
}
interface LeadLite { id: string; name: string }

function GymDashboard() {
  const [rows, setRows] = useState<Health[]>([]);
  const [leads, setLeads] = useState<Record<string, LeadLite>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("member_health")
        .select("*")
        .order("risk_score", { ascending: false })
        .limit(100);
      if (error) toast.error(error.message);
      const list = (data ?? []) as Health[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.lead_id)));
      if (ids.length) {
        const { data: ls } = await supabase.from("leads").select("id, name").in("id", ids);
        setLeads(Object.fromEntries((ls ?? []).map((l) => [l.id, l as LeadLite])));
      }
      setLoading(false);
    })();
  }, []);

  const atRisk = rows.filter((r) => r.risk_score >= 60);
  const withGoals = rows.filter((r) => r.goal && r.goal_target);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Member Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">At-risk prediction and goal tracking for your members.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={AlertTriangle} label="At-risk members" value={atRisk.length} tone="destructive" />
        <StatCard icon={Target} label="Active goals" value={withGoals.length} tone="primary" />
        <StatCard icon={TrendingDown} label="Tracked members" value={rows.length} tone="muted" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">At-risk members</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : atRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No at-risk members. 🎉</p>
          ) : (
            <div className="space-y-2">
              {atRisk.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card">
                  <div>
                    <div className="text-sm font-medium text-foreground">{leads[r.lead_id]?.name ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.visits_last_30} visits last 30d (was {r.visits_prior_30}) · last visit {r.last_visit_at ? new Date(r.last_visit_at).toLocaleDateString() : "never"}
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">Risk {r.risk_score}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Member goals</CardTitle></CardHeader>
        <CardContent>
          {withGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No goals set yet.</p>
          ) : (
            <div className="space-y-3">
              {withGoals.map((r) => {
                const pct = r.goal_target ? Math.min(100, Math.round(((r.goal_current ?? 0) / r.goal_target) * 100)) : 0;
                return (
                  <div key={r.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{leads[r.lead_id]?.name ?? "Unknown"}</span>
                      <span className="text-muted-foreground">{r.goal_current ?? 0} / {r.goal_target} {r.goal_unit ?? ""}</span>
                    </div>
                    <Progress value={pct} />
                    <p className="text-xs text-muted-foreground">{r.goal}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof AlertTriangle; label: string; value: number; tone: "destructive" | "primary" | "muted" }) {
  const cls = tone === "destructive" ? "text-destructive" : tone === "primary" ? "text-primary" : "text-muted-foreground";
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${cls}`} />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold text-foreground">{value}</div></CardContent>
    </Card>
  );
}
