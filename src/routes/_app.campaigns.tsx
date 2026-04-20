import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Plus, Users, Send, BarChart3, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/_app/campaigns")({
  component: CampaignsPage,
  head: () => ({
    meta: [
      { title: "Vireon — Campaigns" },
      { name: "description", content: "Manage automated outreach campaigns" },
    ],
  }),
});

type CampaignStatus = "active" | "paused" | "completed" | "draft";

interface Campaign {
  id: string;
  name: string;
  objective: string | null;
  status: CampaignStatus;
  leads_count: number;
  sent_count: number;
  replies_count: number;
}

const statusVariants: Record<CampaignStatus, "success" | "warning" | "secondary" | "info"> = {
  active: "success",
  paused: "warning",
  completed: "secondary",
  draft: "info",
};

function isCampaignStatus(s: string): s is CampaignStatus {
  return s === "active" || s === "paused" || s === "completed" || s === "draft";
}

function CampaignsPage() {
  const { organization } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, objective, status, leads_count, sent_count, replies_count")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (!error && data) {
        setCampaigns(
          data.map((c) => ({
            id: c.id,
            name: c.name,
            objective: c.objective,
            status: isCampaignStatus(c.status) ? c.status : "draft",
            leads_count: c.leads_count ?? 0,
            sent_count: c.sent_count ?? 0,
            replies_count: c.replies_count ?? 0,
          })),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Automated outreach sequences</p>
        </div>
        <Button variant="command" size="sm">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Zap className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">No campaigns yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first outreach campaign to start engaging leads automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => {
            const conversionRate =
              c.sent_count > 0 ? Math.round((c.replies_count / c.sent_count) * 1000) / 10 : 0;
            return (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{c.name}</h3>
                  <Badge variant={statusVariants[c.status]} className="capitalize">
                    {c.status}
                  </Badge>
                </div>
                {c.objective && (
                  <p className="mt-1 text-xs text-muted-foreground">{c.objective}</p>
                )}
                <div className="mt-4 grid grid-cols-4 gap-4">
                  {[
                    { icon: Users, val: c.leads_count, label: "Leads" },
                    { icon: Send, val: c.sent_count, label: "Sent" },
                    { icon: Zap, val: c.replies_count, label: "Replies" },
                    { icon: BarChart3, val: `${conversionRate}%`, label: "Conversion" },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center gap-2">
                      <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{m.val}</p>
                        <p className="text-[10px] text-muted-foreground">{m.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
