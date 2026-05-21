import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Send, Clock, Users, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  launchCampaignFn,
  previewCampaignAudienceFn,
  updateCampaignDetailsFn,
  type Campaign,
} from "@/functions/campaigns.functions";
import { listStepsFn } from "@/functions/outreach-sequences.functions";
import { toast } from "sonner";

interface Props {
  campaign: Campaign;
  onLaunched: () => void;
}

export function CampaignReviewPanel({ campaign, onLaunched }: Props) {
  const [audience, setAudience] = useState<{
    count: number;
    excluded: { no_email: number; suppressed: number };
  } | null>(null);
  const [stepCount, setStepCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [date, setDate] = useState<Date | undefined>(
    campaign.scheduled_at ? new Date(campaign.scheduled_at) : undefined,
  );
  const [time, setTime] = useState(
    campaign.scheduled_at ? format(new Date(campaign.scheduled_at), "HH:mm") : "09:00",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [aud, steps] = await Promise.all([
          previewCampaignAudienceFn({
            data: {
              organizationId: campaign.organization_id,
              campaignId: campaign.id,
            },
          }),
          campaign.sequence_id
            ? listStepsFn({
                data: {
                  organizationId: campaign.organization_id,
                  sequenceId: campaign.sequence_id,
                },
              })
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setAudience({ count: aud.count, excluded: aud.excluded });
        setStepCount(steps.length);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaign.id, campaign.organization_id, campaign.sequence_id]);

  const canLaunch =
    !loading && audience && audience.count > 0 && stepCount !== null && stepCount > 0;

  const handleSendNow = async () => {
    if (!canLaunch) return;
    setLaunching(true);
    try {
      const result = await launchCampaignFn({
        data: {
          organizationId: campaign.organization_id,
          campaignId: campaign.id,
          mode: "now",
        },
      });
      toast.success(`Launched — ${result.enrolled} leads enrolled`);
      onLaunched();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  };

  const handleSchedule = async () => {
    if (!canLaunch) return;
    if (!date) {
      toast.error("Pick a date");
      return;
    }
    const [hh, mm] = time.split(":").map(Number);
    const scheduled = new Date(date);
    scheduled.setHours(hh ?? 9, mm ?? 0, 0, 0);
    if (scheduled.getTime() <= Date.now()) {
      toast.error("Scheduled time must be in the future");
      return;
    }
    setLaunching(true);
    try {
      await updateCampaignDetailsFn({
        data: {
          organizationId: campaign.organization_id,
          campaignId: campaign.id,
          scheduled_at: scheduled.toISOString(),
        },
      });
      await launchCampaignFn({
        data: {
          organizationId: campaign.organization_id,
          campaignId: campaign.id,
          mode: "scheduled",
        },
      });
      toast.success(`Scheduled for ${format(scheduled, "PPp")}`);
      onLaunched();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Schedule failed");
    } finally {
      setLaunching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <p className="text-xs">Audience</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {audience?.count.toLocaleString() ?? 0}
          </p>
          {audience && (audience.excluded.no_email > 0 || audience.excluded.suppressed > 0) && (
            <p className="mt-1 text-xs text-muted-foreground">
              Excluded: {audience.excluded.no_email} no-email
              {audience.excluded.suppressed > 0
                ? `, ${audience.excluded.suppressed} suppressed`
                : ""}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <p className="text-xs">Steps</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{stepCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <p className="text-xs">Status</p>
          </div>
          <p className="mt-1 text-lg font-semibold capitalize text-foreground">{campaign.status}</p>
        </div>
      </div>

      {!canLaunch && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-foreground">
          {audience && audience.count === 0
            ? "Audience filter resolves to zero leads with an email address."
            : "Add at least one step in the Sequence tab before launching."}
        </div>
      )}

      {(campaign.status === "draft" || campaign.status === "scheduled") && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">Send now</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Enroll the audience immediately. First step fires per its delay setting.
            </p>
            <Button
              type="button"
              variant="command"
              className="mt-4 w-full gap-2"
              onClick={handleSendNow}
              disabled={!canLaunch || launching}
            >
              {launching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send now
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">Schedule</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cron launches the campaign within 5 minutes of the chosen time.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start gap-2 text-left font-normal",
                      !date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {date ? format(date, "PPP") : "Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="p-3"
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-label="Time"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full gap-2"
              onClick={handleSchedule}
              disabled={!canLaunch || launching}
            >
              {launching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              {campaign.status === "scheduled" ? "Update schedule" : "Schedule"}
            </Button>
          </div>
        </div>
      )}

      {campaign.status === "active" && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-foreground">
          Campaign is live. Sends drain via the dispatch-sequences cron every minute.
          {campaign.launched_at && (
            <span className="ml-2 text-xs text-muted-foreground">
              Launched {format(new Date(campaign.launched_at), "PPp")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const _exists = true;
