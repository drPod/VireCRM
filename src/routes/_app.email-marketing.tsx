import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Send,
  Eye,
  MousePointer,
  Users,
  TrendingUp,
  FileText,
  Clock,
  Loader2,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/_app/email-marketing")({
  component: EmailMarketingPage,
  head: () => ({
    meta: [
      { title: "Vireon — Email Marketing" },
      { name: "description", content: "Email campaigns, templates, and analytics" },
    ],
  }),
});

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  leads_count: number | null;
  sent_count: number | null;
  replies_count: number | null;
  created_at: string;
  updated_at: string;
}

interface OrgStats {
  totalLeads: number;
  sent30d: number;
  replies30d: number;
}

function pct(n: number, d: number) {
  if (d <= 0) return "—";
  return ((n / d) * 100).toFixed(1) + "%";
}

function EmailMarketingPage() {
  const { organization } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [orgStats, setOrgStats] = useState<OrgStats>({
    totalLeads: 0,
    sent30d: 0,
    replies30d: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [campaignsRes, leadsRes, sentRes, repliesRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select(
            "id,name,status,objective,leads_count,sent_count,replies_count,created_at,updated_at",
          )
          .eq("organization_id", organization.id)
          .order("updated_at", { ascending: false })
          .limit(50),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organization.id),
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organization.id)
          .eq("type", "email")
          .in("status", ["sent", "delivered", "opened", "replied"])
          .gte("created_at", since),
        supabase
          .from("replies")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organization.id)
          .gte("created_at", since),
      ]);
      if (cancelled) return;
      if (campaignsRes.error) console.warn("campaigns load failed", campaignsRes.error);
      setCampaigns((campaignsRes.data ?? []) as Campaign[]);
      setOrgStats({
        totalLeads: leadsRes.count ?? 0,
        sent30d: sentRes.count ?? 0,
        replies30d: repliesRes.count ?? 0,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  const aggregateReplyRate = useMemo(() => {
    return pct(orgStats.replies30d, orgStats.sent30d);
  }, [orgStats]);

  const lastSent = useMemo(() => {
    const sent = campaigns.filter((c) => c.status === "sent" || c.status === "active");
    if (sent.length === 0) return null;
    return new Date(sent[0].updated_at).toLocaleDateString();
  }, [campaigns]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Marketing</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage outreach campaigns and track performance across your CRM
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/workflows">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                Workflows
              </Button>
            </Link>
            <Link to="/campaigns">
              <Button variant="command" className="gap-2">
                <Plus className="h-4 w-4" />
                New Campaign
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Audience",
              value: orgStats.totalLeads.toLocaleString(),
              icon: Users,
              color: "text-primary",
            },
            {
              label: "Sent (30d)",
              value: orgStats.sent30d.toLocaleString(),
              icon: Send,
              color: "text-foreground",
            },
            {
              label: "Replies (30d)",
              value: orgStats.replies30d.toLocaleString(),
              icon: MousePointer,
              color: "text-warning",
            },
            {
              label: "Reply rate",
              value: aggregateReplyRate,
              icon: TrendingUp,
              color: "text-success",
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Campaigns</h2>

            {loading ? (
              <div className="flex items-center justify-center py-16 rounded-xl border border-border bg-card">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <Mail className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  No campaigns yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create your first email campaign to start tracking performance.
                </p>
                <Link to="/campaigns">
                  <Button variant="command" size="sm" className="mt-4 gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Create campaign
                  </Button>
                </Link>
              </div>
            ) : (
              campaigns.map((campaign) => {
                const sent = campaign.sent_count ?? 0;
                const replies = campaign.replies_count ?? 0;
                const leads = campaign.leads_count ?? 0;
                const isSent = campaign.status === "sent" || campaign.status === "active";
                return (
                  <div
                    key={campaign.id}
                    className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground">{campaign.name}</h3>
                          <Badge
                            variant={
                              isSent
                                ? "default"
                                : campaign.status === "scheduled"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-xs capitalize"
                          >
                            {isSent && <Send className="mr-1 h-2.5 w-2.5" />}
                            {campaign.status === "scheduled" && (
                              <Clock className="mr-1 h-2.5 w-2.5" />
                            )}
                            {campaign.status === "draft" && (
                              <FileText className="mr-1 h-2.5 w-2.5" />
                            )}
                            {campaign.status}
                          </Badge>
                        </div>
                        {campaign.objective && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {campaign.objective}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Updated {new Date(campaign.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-4 border-t border-border pt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Audience</p>
                        <p className="text-sm font-semibold text-foreground">
                          {leads.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sent</p>
                        <p className="text-sm font-semibold text-foreground">
                          {sent.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Replies</p>
                        <p className="text-sm font-semibold text-foreground">
                          {replies.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Reply rate</p>
                        <p className="text-sm font-semibold text-foreground">
                          {pct(replies, sent)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Activity</h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Last sent</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {lastSent ?? "Never"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Total campaigns</span>
                  </div>
                  <span className="font-medium text-foreground">{campaigns.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Drafts</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {campaigns.filter((c) => c.status === "draft").length}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <h3 className="text-sm font-semibold text-foreground">
                Templates & deliverability
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Reusable templates and inbox-deliverability scoring are rolling out next.
                For now, send via campaigns and outreach workflows.
              </p>
              <Link to="/workflows">
                <Button variant="outline" size="sm" className="mt-3 w-full gap-1 text-xs">
                  Open Workflows
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
