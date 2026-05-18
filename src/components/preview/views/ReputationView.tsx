import { CheckCircle2, MessageCircle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RATING_BREAKDOWN, REVIEWS } from "../data/reputation";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= rating ? "fill-[oklch(0.78_0.16_85)] text-[oklch(0.78_0.16_85)]" : "text-muted"
          }`}
        />
      ))}
    </div>
  );
}

export function ReputationView() {
  const total = RATING_BREAKDOWN.reduce((sum, r) => sum + r.count, 0);
  const avg =
    RATING_BREAKDOWN.reduce((sum, r) => sum + r.stars * r.count, 0) / Math.max(1, total);

  return (
    <div data-tour="reputation" className="space-y-6 scroll-mt-24">
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall rating</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-4xl font-bold text-foreground">{avg.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">/ 5.0</p>
          </div>
          <div className="mt-2">
            <StarRow rating={Math.round(avg)} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{total} reviews across 4 platforms</p>

          <div className="mt-5 space-y-1.5">
            {RATING_BREAKDOWN.slice()
              .reverse()
              .map((r) => {
                const pct = total > 0 ? (r.count / total) * 100 : 0;
                return (
                  <div key={r.stars} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-muted-foreground">{r.stars}</span>
                    <Star className="h-3 w-3 fill-[oklch(0.78_0.16_85)] text-[oklch(0.78_0.16_85)]" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[oklch(0.78_0.16_85)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-muted-foreground">{r.count}</span>
                  </div>
                );
              })}
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Review velocity</p>
            <p className="mt-1 text-2xl font-bold text-foreground">+14 this week</p>
            <p className="text-[10px] text-success">Above 4-week trailing average</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Response rate</p>
            <p className="mt-1 text-2xl font-bold text-foreground">94%</p>
            <p className="text-[10px] text-muted-foreground">avg time to reply · 6h</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sentiment (last 30d)</p>
            <p className="mt-1 text-2xl font-bold text-success">+78</p>
            <p className="text-[10px] text-muted-foreground">net promoter score</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Auto-requests sent</p>
            <p className="mt-1 text-2xl font-bold text-foreground">312</p>
            <p className="text-[10px] text-muted-foreground">post-purchase &amp; post-call</p>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <h3 className="text-base font-semibold text-foreground">Recent reviews</h3>
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
                  <MessageCircle className="h-3.5 w-3.5" />
                  Request reviews
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign up to auto-request reviews from customers.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="divide-y divide-border/40">
          {REVIEWS.map((r) => (
            <div key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-[oklch(0.65_0.16_320)]/30 text-xs font-semibold text-foreground">
                    {r.reviewer.split(" ").map((s) => s[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.reviewer}</p>
                    <div className="flex items-center gap-2">
                      <StarRow rating={r.rating} />
                      <Badge variant="outline" className="text-[10px]">
                        {r.source}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{r.date}</span>
                    </div>
                  </div>
                </div>
                {r.responded && (
                  <Badge variant="outline" className="gap-1 text-[10px] border-success/30 bg-success/10 text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Responded
                  </Badge>
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{r.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
