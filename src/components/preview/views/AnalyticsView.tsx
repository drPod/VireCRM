import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CHANNEL_BREAKDOWN, FUNNEL, REPS } from "../data/analytics";

export function AnalyticsView() {
  const maxFunnel = FUNNEL[0].count;

  return (
    <div data-tour="analytics" className="space-y-6 scroll-mt-24">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Conversion funnel</h3>
          </div>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 cursor-not-allowed opacity-70"
                  aria-disabled="true"
                  onClick={(e) => e.preventDefault()}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign up to export reports.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="space-y-3 p-5">
          {FUNNEL.map((stage, i) => {
            const widthPct = (stage.count / maxFunnel) * 100;
            const prev = i > 0 ? FUNNEL[i - 1].count : null;
            const dropPct = prev ? ((prev - stage.count) / prev) * 100 : 0;
            return (
              <div key={stage.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <p className="font-medium text-foreground">{stage.name}</p>
                  <p className="text-muted-foreground">
                    {stage.count.toLocaleString()} · {stage.rate.toFixed(1)}%
                    {prev && (
                      <span className="ml-2 text-destructive">−{dropPct.toFixed(0)}% drop</span>
                    )}
                  </p>
                </div>
                <div className="h-7 overflow-hidden rounded-md bg-muted">
                  <div
                    className="flex h-full items-center bg-gradient-to-r from-primary to-[oklch(0.65_0.16_320)] px-3 text-[11px] font-semibold text-primary-foreground"
                    style={{ width: `${widthPct}%` }}
                  >
                    {widthPct > 8 && stage.count.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-border/60 px-5 py-3">
            <h3 className="text-base font-semibold text-foreground">Channel performance</h3>
            <p className="text-xs text-muted-foreground">Reply rate by outreach channel</p>
          </div>
          <div className="p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Replies</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CHANNEL_BREAKDOWN.map((c) => (
                  <TableRow key={c.channel}>
                    <TableCell className="font-medium text-foreground">{c.channel}</TableCell>
                    <TableCell className="text-right">{c.sent.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{c.replied.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {c.rate.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border/60 px-5 py-3">
            <h3 className="text-base font-semibold text-foreground">Rep leaderboard</h3>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <div className="divide-y divide-border/40">
            {REPS.map((r, i) => (
              <div key={r.name} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-[oklch(0.65_0.16_320)]/30 text-[10px] font-semibold text-foreground">
                    {r.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      avg response · {r.responseMin} min
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{r.closed} closed</p>
                  <p className="text-[10px] text-muted-foreground">
                    ${r.pipeline.toLocaleString()} pipeline · {r.winRate}% win
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
