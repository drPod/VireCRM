import { CalendarDays, Clock, MapPin, Video } from "lucide-react";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

interface Event {
  day: number;
  start: number;
  length: number;
  title: string;
  attendee: string;
  type: "video" | "in-person" | "call";
  tone: "primary" | "accent" | "muted";
}

const EVENTS: Event[] = [
  { day: 0, start: 9, length: 1, title: "Discovery — Apex", attendee: "Sarah Chen", type: "video", tone: "primary" },
  { day: 1, start: 11, length: 1, title: "Demo — Northwind", attendee: "Marcus Webb", type: "video", tone: "accent" },
  { day: 2, start: 14, length: 2, title: "On-site — Helix", attendee: "David Okafor", type: "in-person", tone: "muted" },
  { day: 3, start: 10, length: 1, title: "Quote review", attendee: "Priya Patel", type: "call", tone: "primary" },
  { day: 4, start: 15, length: 1, title: "Close call — Polaris", attendee: "Emma L.", type: "video", tone: "accent" },
];

const TONE_CLASSES: Record<Event["tone"], string> = {
  primary: "bg-primary/15 border-primary/40 text-primary",
  accent: "bg-[oklch(0.65_0.16_320/0.15)] border-[oklch(0.65_0.16_320/0.4)] text-[oklch(0.55_0.18_320)]",
  muted: "bg-success/15 border-success/40 text-success",
};

const TYPE_ICON = {
  video: Video,
  "in-person": MapPin,
  call: Clock,
} as const;

export function CalendarMock() {
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Week of May 19</p>
        </div>
        <div className="flex gap-1">
          <Pill>Round-robin</Pill>
          <Pill>Auto-reminders</Pill>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
        <div className="grid grid-cols-[40px_repeat(5,1fr)] border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
          <div className="py-1.5" />
          {DAYS.map((d) => (
            <div key={d} className="py-1.5 text-center font-semibold">
              {d}
            </div>
          ))}
        </div>
        <div className="relative grid grid-cols-[40px_repeat(5,1fr)]">
          {HOURS.map((h) => (
            <div key={`h-${h}`} className="border-t border-border/40 pr-1 pt-1 text-right text-[9px] text-muted-foreground">
              {h > 12 ? `${h - 12}p` : `${h}a`}
            </div>
          ))}
          {DAYS.map((_, dIdx) =>
            HOURS.map((h) => (
              <div
                key={`cell-${dIdx}-${h}`}
                className="border-l border-t border-border/40"
                style={{ minHeight: 28 }}
              />
            )),
          )}
          {EVENTS.map((e) => {
            const Icon = TYPE_ICON[e.type];
            const topRow = HOURS.indexOf(e.start);
            return (
              <div
                key={`${e.day}-${e.start}-${e.title}`}
                className={`pointer-events-none absolute rounded-lg border-l-2 px-1.5 py-1 text-[10px] leading-tight ${TONE_CLASSES[e.tone]}`}
                style={{
                  top: topRow * 28 + 2,
                  height: e.length * 28 - 4,
                  // Column: 40px gutter + e.day columns × (cell width). Use CSS calc.
                  left: `calc(40px + ${e.day} * ((100% - 40px) / 5) + 4px)`,
                  width: `calc(((100% - 40px) / 5) - 8px)`,
                }}
              >
                <div className="flex items-center gap-1 font-semibold text-foreground">
                  <Icon className="h-2.5 w-2.5" />
                  {e.title}
                </div>
                <div className="truncate text-[9px] text-muted-foreground">{e.attendee}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="Booked this week" value="14" />
        <Stat label="No-show rate" value="3%" />
        <Stat label="Avg lead-to-meeting" value="2.1d" />
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
