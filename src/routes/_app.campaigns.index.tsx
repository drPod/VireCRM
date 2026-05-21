import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Plus, Users, Send, BarChart3, Loader2, Play, Pause, Trash2 } from "lucide-react";
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
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  pauseCampaignFn,
  resumeCampaignFn,
  deleteCampaignFn,
} from "@/functions/campaigns.functions";
import { toast } from "sonner";

type CampaignsSearch = { new?: boolean };

export const Route = createFileRoute("/_app/campaigns/")({
  component: CampaignsPage,
  validateSearch: (search: Record<string, unknown>): CampaignsSearch => {
    const isNew =
      search.new === true || search.new === "1" || search.new === 1 || search.new === "true";
    return isNew ? { new: true } : {};
  },
  head: () => ({
    meta: [
      { title: "VireCRM — Campaigns" },
      { name: "description", content: "Manage automated outreach campaigns" },
    ],
  }),
});

type CampaignStatus = "active" | "paused" | "completed" | "draft" | "scheduled";

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
  scheduled: "warning",
  completed: "secondary",
  draft: "info",
};

function isCampaignStatus(s: string): s is CampaignStatus {
  return (
    s === "active" || s === "paused" || s === "completed" || s === "draft" || s === "scheduled"
  );
}

function CampaignsPage() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const { new: openNew } = Route.useSearch();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);

  useEffect(() => {
    if (openNew) {
      navigate({ to: "/campaigns/new", replace: true });
    }
  }, [openNew, navigate]);

  const loadCampaigns = async (orgId: string) => {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name, objective, status, leads_count, sent_count, replies_count")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200);
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
  };

  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadCampaigns(organization.id);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  const handlePause = async (c: Campaign) => {
    if (!organization?.id) return;
    setBusyId(c.id);
    try {
      await pauseCampaignFn({
        data: { organizationId: organization.id, campaignId: c.id },
      });
      toast.success("Paused");
      await loadCampaigns(organization.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setBusyId(null);
    }
  };
  const handleResume = async (c: Campaign) => {
    if (!organization?.id) return;
    setBusyId(c.id);
    try {
      await resumeCampaignFn({
        data: { organizationId: organization.id, campaignId: c.id },
      });
      toast.success("Resumed");
      await loadCampaigns(organization.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setBusyId(null);
    }
  };
  const handleDelete = async () => {
    if (!confirmDelete || !organization?.id) return;
    const c = confirmDelete;
    setBusyId(c.id);
    try {
      await deleteCampaignFn({
        data: { organizationId: organization.id, campaignId: c.id },
      });
      toast.success("Campaign deleted");
      await loadCampaigns(organization.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Automated outreach sequences</p>
        </div>
        <Button variant="command" size="sm" asChild>
          <Link to="/campaigns/new">
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
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
          <Button variant="command" size="sm" className="mt-4" asChild>
            <Link to="/campaigns/new">
              <Plus className="h-4 w-4" />
              New Campaign
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => {
            const conversionRate =
              c.sent_count > 0 ? Math.round((c.replies_count / c.sent_count) * 1000) / 10 : 0;
            return (
              <Link
                key={c.id}
                to="/campaigns/$id"
                params={{ id: c.id }}
                className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Zap className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground truncate">{c.name}</h3>
                    <Badge variant={statusVariants[c.status]} className="capitalize">
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.status === "active" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Pause"
                        disabled={busyId === c.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePause(c);
                        }}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : c.status === "paused" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Resume"
                        disabled={busyId === c.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleResume(c);
                        }}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Delete"
                      disabled={busyId === c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDelete(c);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {c.objective && <p className="mt-1 text-xs text-muted-foreground">{c.objective}</p>}
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
              </Link>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
