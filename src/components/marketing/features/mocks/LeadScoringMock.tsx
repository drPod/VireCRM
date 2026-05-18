import { ArrowDownRight, ArrowUpRight, Flame, Sparkles } from "lucide-react";

const LEADS = [
  {
    name: "Marcus Webb",
    company: "Northwind Energy",
    score: 94,
    delta: +12,
    signals: ["Opened pricing 4×", "Replied within 6m", "Visited /demo"],
    hot: true,
  },
  {
    name: "Sarah Chen",
    company: "Apex Logistics",
    score: 88,
    delta: +6,
    signals: ["Booked call · cancelled", "Re-engaged today"],
    hot: true,
  },
  {
    name: "Priya Patel",
    company: "BlueRiver Tech",
    score: 71,
    delta: +3,
    signals: ["Opened follow-up", "On mobile"],
    hot: false,
  },
  {
    name: "Emma Lindqvist",
    company: "Polaris Retail",
    score: 42,
    delta: -8,
    signals: ["Bounced last email"],
    hot: false,
  },
];

export function LeadScoringMock() {
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            AI lead score · today
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">12 hot leads · 4 cooling</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Updated 12s ago
        </span>
      </div>

      <div className="space-y-2">
        {LEADS.map((lead) => (
          <div
            key={lead.name}
            className="rounded-xl border border-border/60 bg-card/60 px-3 py-2.5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {lead.name}
                  {lead.hot ? <Flame className="h-3 w-3 text-[oklch(0.7_0.2_30)]" /> : null}
                </p>
                <p className="text-[11px] text-muted-foreground">{lead.company}</p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center gap-1 text-[11px] font-medium ${
                    lead.delta >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {lead.delta >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(lead.delta)}
                </div>
                <ScoreBar value={lead.score} />
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {lead.signals.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  const tone =
    value >= 85
      ? "from-[oklch(0.7_0.2_30)] to-[oklch(0.7_0.2_50)]"
      : value >= 65
        ? "from-primary to-[oklch(0.65_0.16_320)]"
        : "from-muted-foreground/40 to-muted-foreground/20";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted/60">
        <div
          className={`h-full bg-gradient-to-r ${tone}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="w-7 text-right text-sm font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}
