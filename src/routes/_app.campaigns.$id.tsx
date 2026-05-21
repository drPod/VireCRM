import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Save, Pause, Play, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getCampaignFn,
  updateCampaignDetailsFn,
  pauseCampaignFn,
  resumeCampaignFn,
  completeCampaignFn,
  type Campaign,
} from "@/functions/campaigns.functions";
import { upsertSequenceFn } from "@/functions/outreach-sequences.functions";
import { supabase } from "@/integrations/supabase/client";
import { AudienceFilterBuilder } from "@/components/campaigns/AudienceFilterBuilder";
import { CampaignStepList } from "@/components/campaigns/CampaignStepList";
import { CampaignReviewPanel } from "@/components/campaigns/CampaignReviewPanel";
import type { AudienceFilter } from "@/lib/campaigns/audience-filter";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/campaigns/$id")({
  component: CampaignBuilderPage,
  head: () => ({
    meta: [{ title: "VireCRM — Campaign Builder" }],
  }),
});

interface SequenceSettings {
  stop_on_reply: boolean;
  stop_on_meeting_booked: boolean;
  send_window_start_hour: number;
  send_window_end_hour: number;
  send_on_weekends: boolean;
  timezone: string;
}

function CampaignBuilderPage() {
  const { id } = Route.useParams();
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"details" | "audience" | "sequence" | "settings" | "review">(
    "details",
  );

  // Details
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [detailsSaving, setDetailsSaving] = useState(false);

  // Audience
  const [filter, setFilter] = useState<AudienceFilter>({});
  const [audienceSaving, setAudienceSaving] = useState(false);

  // Settings
  const [settings, setSettings] = useState<SequenceSettings>({
    stop_on_reply: true,
    stop_on_meeting_booked: true,
    send_window_start_hour: 9,
    send_window_end_hour: 17,
    send_on_weekends: false,
    timezone: "UTC",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!organization?.id) return;
    const c = await getCampaignFn({
      data: { organizationId: organization.id, campaignId: id },
    });
    setCampaign(c);
    setName(c.name);
    setObjective(c.objective ?? "");
    setFromName(c.from_name ?? "");
    setReplyTo(c.reply_to ?? "");
    setFilter((c.audience_filter ?? {}) as AudienceFilter);

    if (c.sequence_id) {
      const { data: seq } = await supabase
        .from("outreach_sequences")
        .select(
          "stop_on_reply, stop_on_meeting_booked, send_window_start_hour, send_window_end_hour, send_on_weekends, timezone",
        )
        .eq("id", c.sequence_id)
        .single();
      if (seq) {
        setSettings({
          stop_on_reply: seq.stop_on_reply,
          stop_on_meeting_booked: seq.stop_on_meeting_booked,
          send_window_start_hour: seq.send_window_start_hour,
          send_window_end_hour: seq.send_window_end_hour,
          send_on_weekends: seq.send_on_weekends,
          timezone: seq.timezone,
        });
      }
    }
  }, [organization?.id, id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await reload();
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load campaign");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const saveDetails = async () => {
    if (!organization?.id || !campaign) return;
    setDetailsSaving(true);
    try {
      await updateCampaignDetailsFn({
        data: {
          organizationId: organization.id,
          campaignId: campaign.id,
          name: name.trim() || undefined,
          objective: objective.trim() || null,
          from_name: fromName.trim() || null,
          reply_to: replyTo.trim() || null,
        },
      });
      toast.success("Details saved");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setDetailsSaving(false);
    }
  };

  const saveAudience = async () => {
    if (!organization?.id || !campaign) return;
    setAudienceSaving(true);
    try {
      await updateCampaignDetailsFn({
        data: {
          organizationId: organization.id,
          campaignId: campaign.id,
          audience_filter: filter,
        },
      });
      toast.success("Audience saved");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setAudienceSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!organization?.id || !campaign?.sequence_id) return;
    setSettingsSaving(true);
    try {
      await upsertSequenceFn({
        data: {
          organizationId: organization.id,
          id: campaign.sequence_id,
          name: campaign.name,
          stop_on_reply: settings.stop_on_reply,
          stop_on_meeting_booked: settings.stop_on_meeting_booked,
          send_window_start_hour: settings.send_window_start_hour,
          send_window_end_hour: settings.send_window_end_hour,
          send_on_weekends: settings.send_on_weekends,
          timezone: settings.timezone,
        },
      });
      toast.success("Send settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handlePause = async () => {
    if (!organization?.id || !campaign) return;
    setBusy(true);
    try {
      await pauseCampaignFn({
        data: { organizationId: organization.id, campaignId: campaign.id },
      });
      toast.success("Paused");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setBusy(false);
    }
  };
  const handleResume = async () => {
    if (!organization?.id || !campaign) return;
    setBusy(true);
    try {
      await resumeCampaignFn({
        data: { organizationId: organization.id, campaignId: campaign.id },
      });
      toast.success("Resumed");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setBusy(false);
    }
  };
  const handleComplete = async () => {
    if (!organization?.id || !campaign) return;
    if (!confirm("Mark this campaign complete? In-flight sends will stop.")) return;
    setBusy(true);
    try {
      await completeCampaignFn({
        data: { organizationId: organization.id, campaignId: campaign.id },
      });
      toast.success("Marked complete");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Complete failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !campaign) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isLive = campaign.status === "active" || campaign.status === "scheduled";
  const isFinal = campaign.status === "completed";

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 gap-1 text-muted-foreground"
              onClick={() => navigate({ to: "/campaigns" })}
            >
              <ArrowLeft className="h-4 w-4" />
              All campaigns
            </Button>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-foreground">{campaign.name}</h1>
              <Badge
                variant={
                  campaign.status === "active"
                    ? "success"
                    : campaign.status === "scheduled"
                      ? "warning"
                      : campaign.status === "paused"
                        ? "warning"
                        : campaign.status === "completed"
                          ? "secondary"
                          : "info"
                }
                className="capitalize"
              >
                {campaign.status}
              </Badge>
            </div>
            {campaign.objective && (
              <p className="mt-1 text-sm text-muted-foreground">{campaign.objective}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {campaign.status === "active" && (
              <Button variant="outline" size="sm" onClick={handlePause} disabled={busy}>
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}
            {campaign.status === "paused" && (
              <Button variant="outline" size="sm" onClick={handleResume} disabled={busy}>
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}
            {isLive && (
              <Button variant="outline" size="sm" onClick={handleComplete} disabled={busy}>
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </Button>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            <TabsTrigger value="sequence">Sequence</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Name</Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isFinal}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-objective">Objective</Label>
                <Textarea
                  id="campaign-objective"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  rows={3}
                  disabled={isFinal}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="from-name">From name (optional)</Label>
                  <Input
                    id="from-name"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder="Crystal at Acme"
                    disabled={isFinal}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reply-to">Reply-to (optional)</Label>
                  <Input
                    id="reply-to"
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="crystal@acme.com"
                    disabled={isFinal}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="command"
                  onClick={saveDetails}
                  disabled={detailsSaving || isFinal}
                >
                  {detailsSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save details
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="audience" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              {organization?.id && (
                <AudienceFilterBuilder
                  organizationId={organization.id}
                  value={filter}
                  onChange={setFilter}
                />
              )}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="command"
                  onClick={saveAudience}
                  disabled={audienceSaving || isFinal}
                >
                  {audienceSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save audience
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sequence" className="mt-6">
            {organization?.id && campaign.sequence_id ? (
              <CampaignStepList
                organizationId={organization.id}
                sequenceId={campaign.sequence_id}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Linked sequence missing — recreate the campaign.
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="window-start">Send window start (UTC hour)</Label>
                  <Input
                    id="window-start"
                    type="number"
                    min={0}
                    max={23}
                    value={settings.send_window_start_hour}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        send_window_start_hour: Math.max(0, Math.min(23, +e.target.value || 0)),
                      })
                    }
                    disabled={isFinal}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="window-end">Send window end (UTC hour)</Label>
                  <Input
                    id="window-end"
                    type="number"
                    min={0}
                    max={23}
                    value={settings.send_window_end_hour}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        send_window_end_hour: Math.max(0, Math.min(23, +e.target.value || 0)),
                      })
                    }
                    disabled={isFinal}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="weekends" className="text-sm">
                      Send on weekends
                    </Label>
                    <p className="text-xs text-muted-foreground">Saturday + Sunday.</p>
                  </div>
                  <Switch
                    id="weekends"
                    checked={settings.send_on_weekends}
                    onCheckedChange={(v) => setSettings({ ...settings, send_on_weekends: v })}
                    disabled={isFinal}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="stop-reply" className="text-sm">
                      Stop on reply
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      End enrollment when the lead replies.
                    </p>
                  </div>
                  <Switch
                    id="stop-reply"
                    checked={settings.stop_on_reply}
                    onCheckedChange={(v) => setSettings({ ...settings, stop_on_reply: v })}
                    disabled={isFinal}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="stop-meeting" className="text-sm">
                      Stop on meeting booked
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      End enrollment when an appointment is created.
                    </p>
                  </div>
                  <Switch
                    id="stop-meeting"
                    checked={settings.stop_on_meeting_booked}
                    onCheckedChange={(v) => setSettings({ ...settings, stop_on_meeting_booked: v })}
                    disabled={isFinal}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="command"
                  onClick={saveSettings}
                  disabled={settingsSaving || isFinal}
                >
                  {settingsSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save settings
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="review" className="mt-6">
            <CampaignReviewPanel campaign={campaign} onLaunched={reload} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
