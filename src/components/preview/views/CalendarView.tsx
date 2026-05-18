import { CalendarPlus, ChevronLeft, ChevronRight, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CAL_EVENTS, CAL_MONTH, CAL_YEAR, type CalEvent } from "../data/calendar";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function eventColor(type: CalEvent["type"]): string {
  switch (type) {
    case "demo":
      return "bg-primary/15 text-primary border-primary/30";
    case "discovery":
      return "bg-[oklch(0.7_0.18_50)]/15 text-[oklch(0.7_0.18_50)] border-[oklch(0.7_0.18_50)]/30";
    case "internal":
      return "bg-muted text-foreground border-border";
    case "personal":
      return "bg-[oklch(0.65_0.18_320)]/15 text-[oklch(0.65_0.18_320)] border-[oklch(0.65_0.18_320)]/30";
    case "follow-up":
      return "bg-success/15 text-success border-success/30";
  }
}

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarView() {
  const cells = buildMonthGrid(CAL_YEAR, CAL_MONTH);
  const eventsByDay = new Map<number, CalEvent[]>();
  for (const e of CAL_EVENTS) {
    if (!eventsByDay.has(e.day)) eventsByDay.set(e.day, []);
    eventsByDay.get(e.day)!.push(e);
  }
  const upcoming = [...CAL_EVENTS].sort((a, b) => a.day - b.day || a.startHour - b.startHour).slice(0, 6);

  return (
    <div data-tour="calendar" className="space-y-6 scroll-mt-24">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Booked this month</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{CAL_EVENTS.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Demos</p>
          <p className="mt-1 text-2xl font-bold text-primary">
            {CAL_EVENTS.filter((e) => e.type === "demo").length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">No-show rate</p>
          <p className="mt-1 text-2xl font-bold text-success">3.4%</p>
          <p className="text-[10px] text-muted-foreground">vs 17% industry average</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-not-allowed opacity-60"
                aria-disabled="true"
                aria-label="Previous month (disabled in preview)"
                onClick={(e) => e.preventDefault()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-base font-semibold text-foreground">
                {MONTH_NAMES[CAL_MONTH]} {CAL_YEAR}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-not-allowed opacity-60"
                aria-disabled="true"
                aria-label="Next month (disabled in preview)"
                onClick={(e) => e.preventDefault()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
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
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Book meeting
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign up to host real bookings.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20">
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="border-r border-border/60 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const dayEvents = d !== null ? eventsByDay.get(d) ?? [] : [];
              return (
                <div
                  key={i}
                  className="min-h-[96px] border-b border-r border-border/60 p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0"
                >
                  {d !== null && (
                    <>
                      <p className="mb-1 text-xs font-medium text-foreground">{d}</p>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((e) => (
                          <div
                            key={e.id}
                            className={`truncate rounded border px-1.5 py-0.5 text-[10px] ${eventColor(e.type)}`}
                            title={e.title}
                          >
                            <span className="font-medium">{formatHour(e.startHour)}</span>{" "}
                            <span className="opacity-80">{e.title.replace(/^(Demo|Discovery|Internal|Personal|Follow-up) · /, "")}</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <p className="text-[10px] text-muted-foreground">
                            +{dayEvents.length - 2} more
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border/60 px-5 py-3">
            <h3 className="text-base font-semibold text-foreground">Up next</h3>
            <p className="text-xs text-muted-foreground">Confirmed bookings this week</p>
          </div>
          <div className="space-y-2 p-4">
            {upcoming.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border border-border/60 bg-card/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${eventColor(e.type)}`}
                  >
                    {e.type}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {MONTH_NAMES[e.month]} {e.day} · {formatHour(e.startHour)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-foreground">{e.title}</p>
                {e.attendee && (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Video className="h-3 w-3" />
                    {e.attendee}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-border/60 p-4">
            <Badge variant="outline" className="w-full justify-center text-[10px]">
              Round-robin · auto-reminders 24h · SMS 1h · 10min push
            </Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  const hour = Math.floor(h);
  const min = (h - hour) * 60;
  const ampm = hour >= 12 ? "pm" : "am";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return min === 0 ? `${display}${ampm}` : `${display}:${min.toString().padStart(2, "0")}${ampm}`;
}
