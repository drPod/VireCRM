import { ArrowUpRight, Pause, Play, Plus, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CAMPAIGNS, type Campaign, type CampaignStatus } from "../data/campaigns";

function statusBadge(s: CampaignStatus) {
  if (s === "Active") return { cls: "bg-success/15 text-success border-success/30", Icon: Play };
  if (s === "Paused") return { cls: "bg-muted text-muted-foreground border-border", Icon: Pause };
  if (s === "Scheduled")
    return { cls: "bg-primary/15 text-primary border-primary/30", Icon: Play };
  if (s === "Completed")
    return { cls: "bg-foreground/10 text-foreground border-border", Icon: Play };
  return { cls: "bg-muted/40 text-muted-foreground border-border", Icon: Zap };
}

function rate(n: number, of: number): string {
  if (of === 0) return "—";
  return `${((n / of) * 100).toFixed(1)}%`;
}

export function CampaignsView() {
  const totals = CAMPAIGNS.reduce(
    (acc, c) => {
      acc.sent += c.sent;
      acc.opened += c.opened;
      acc.replied += c.replied;
      acc.booked += c.booked;
      return acc;
    },
    { sent: 0, opened: 0, replied: 0, booked: 0 },
  );

  return (
    <div data-tour="campaigns" className="space-y-6 scroll-mt-24">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total sent</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totals.sent.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Open rate</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{rate(totals.opened, totals.sent)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Reply rate</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{rate(totals.replied, totals.sent)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Bookings driven</p>
          <p className="mt-1 text-2xl font-bold text-success">{totals.booked}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Active + recent campaigns</h3>
          <p className="text-xs text-muted-foreground">Performance is calculated nightly</p>
        </div>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="command"
                size="sm"
                className="gap-1.5 cursor-not-allowed opacity-70"
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
              >
                <Plus className="h-3.5 w-3.5" />
                New campaign
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign up to launch real campaigns.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CAMPAIGNS.map((c) => {
          const sb = statusBadge(c.status);
          return (
            <Card key={c.id} className="overflow-hidden">
              <div className="border-b border-border/60 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sb.cls}`}
                  >
                    <sb.Icon className="h-3 w-3" />
                    {c.status}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {c.channel}
                  </Badge>
                </div>
                <h4 className="mt-2 text-sm font-semibold text-foreground">{c.name}</h4>
                <p className="text-xs text-muted-foreground">{c.audience}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-5">
                <CampaignStat label="Sent" value={c.sent.toLocaleString()} />
                <CampaignStat label="Opened" value={rate(c.opened, c.sent)} sub={c.opened.toLocaleString()} />
                <CampaignStat label="Replied" value={rate(c.replied, c.sent)} sub={c.replied.toLocaleString()} />
                <CampaignStat
                  label="Booked"
                  value={c.booked.toString()}
                  sub={c.sent > 0 ? `${((c.booked / c.sent) * 100).toFixed(2)}% rate` : "—"}
                />
              </div>

              <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
                <p className="text-[10px] text-muted-foreground">Launched {c.launched}</p>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 cursor-not-allowed opacity-70"
                        aria-disabled="true"
                        onClick={(e) => e.preventDefault()}
                      >
                        Details
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sign up to drill into campaign performance.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CampaignStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
