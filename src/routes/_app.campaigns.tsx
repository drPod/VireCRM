import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Plus, Users, Send, BarChart3, Loader2, LineChart, Play, Pause, Trash2 } from "lucide-react";
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
import { toast } from "sonner";

type CampaignsSearch = { new?: boolean };

export const Route = createFileRoute("/_app/campaigns")({
  component: CampaignsPage,
  validateSearch: (search: Record<string, unknown>): CampaignsSearch => {
    const isNew = search.new === true || search.new === "1" || search.new === 1 || search.new === "true";
    return isNew ? { new: true } : {};
  },
  head: () => ({
    meta: [
      { title: "Genesis — Campaigns" },
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
  const navigate = useNavigate();
  const { new: openNew } = Route.useSearch();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [status, setStatus] = useState<CampaignStatus>("draft");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);

  // Auto-open the create dialog when arriving with ?new=1, then strip the param.
  useEffect(() => {
    if (openNew) {
      setDialogOpen(true);
      navigate({
        to: "/campaigns",
        search: (prev: CampaignsSearch) => ({ ...prev, new: undefined }),
        replace: true,
      });
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

  const resetForm = () => {
    setName("");
    setObjective("");
    setStatus("draft");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Campaign name is required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("campaigns").insert({
      organization_id: organization.id,
      name: trimmedName,
      objective: objective.trim() || null,
      status,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Failed to create campaign");
      return;
    }
    toast.success("Campaign created");
    setDialogOpen(false);
    resetForm();
    await loadCampaigns(organization.id);
  };

  const setCampaignStatus = async (c: Campaign, next: CampaignStatus) => {
    if (!organization?.id) return;
    setBusyId(c.id);
    const { error } = await supabase
      .from("campaigns")
      .update({ status: next })
      .eq("id", c.id)
      .eq("organization_id", organization.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message || "Update failed");
      return;
    }
    toast.success(next === "active" ? "Campaign resumed" : next === "paused" ? "Campaign paused" : "Campaign updated");
    await loadCampaigns(organization.id);
  };

  const handleDelete = async () => {
    if (!confirmDelete || !organization?.id) return;
    const c = confirmDelete;
    setBusyId(c.id);
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", c.id)
      .eq("organization_id", organization.id);
    setBusyId(null);
    setConfirmDelete(null);
    if (error) {
      toast.error(error.message || "Delete failed");
      return;
    }
    toast.success("Campaign deleted");
    await loadCampaigns(organization.id);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Automated outreach sequences</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/campaigns/analytics">
              <LineChart className="h-4 w-4" />
              View analytics
            </Link>
          </Button>
          <Button variant="command" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </div>
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
          <Button
            variant="command"
            size="sm"
            className="mt-4"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
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
                        onClick={() => setCampaignStatus(c, "paused")}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : c.status === "paused" || c.status === "draft" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={c.status === "draft" ? "Activate" : "Resume"}
                        disabled={busyId === c.id}
                        onClick={() => setCampaignStatus(c, "active")}
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
                      onClick={() => setConfirmDelete(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>New Campaign</DialogTitle>
              <DialogDescription>
                Create a new outreach campaign. You can wire it up to leads and workflows
                afterwards.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Name</Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Q1 enterprise outbound"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-objective">Objective (optional)</Label>
                <Textarea
                  id="campaign-objective"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Book demos with mid-market SaaS founders"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => isCampaignStatus(v) && setStatus(v)}
                >
                  <SelectTrigger id="campaign-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="command" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create campaign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
