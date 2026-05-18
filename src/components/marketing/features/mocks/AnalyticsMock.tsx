import { ArrowUpRight, TrendingUp } from "lucide-react";

const SPARKLINE: number[] = [22, 28, 31, 27, 34, 41, 38, 47, 52, 49, 58, 64, 71, 68, 79];
const WIDTH = 320;
const HEIGHT = 120;

const STAGE_FUNNEL: { label: string; value: number; pct: number }[] = [
  { label: "Leads in", value: 1284, pct: 100 },
  { label: "Replied", value: 612, pct: 48 },
  { label: "Qualified", value: 287, pct: 22 },
  { label: "Booked", value: 134, pct: 10.4 },
  { label: "Won", value: 47, pct: 3.7 },
];

export function AnalyticsMock() {
  const max = Math.max(...SPARKLINE);
  const min = Math.min(...SPARKLINE);
  const step = WIDTH / (SPARKLINE.length - 1);

  const points = SPARKLINE.map((v, i) => {
    const x = i * step;
    const y = HEIGHT - ((v - min) / (max - min || 1)) * HEIGHT * 0.85 - 8;
    return [x, y] as const;
  });

  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${path} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Revenue · last 14 days
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-bold text-foreground">$184,920</p>
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-success">
              <ArrowUpRight className="h-3 w-3" />
              +24.8%
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
          <TrendingUp className="h-3 w-3" /> Forecast on track
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-32 w-full"
        aria-label="Revenue trend last 14 days"
      >
        <defs>
          <linearGradient id="features-analytics-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.7 0.18 290)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="oklch(0.7 0.18 290)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#features-analytics-gradient)" />
        <path
          d={path}
          fill="none"
          stroke="oklch(0.55 0.18 290)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === points.length - 1 ? 4 : 0}
            fill="oklch(0.55 0.18 290)"
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pipeline funnel
        </p>
        <div className="space-y-1.5">
          {STAGE_FUNNEL.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <p className="w-20 shrink-0 text-xs text-muted-foreground">{s.label}</p>
              <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-muted/50">
                <div
                  className="h-full bg-gradient-to-r from-primary/80 to-[oklch(0.65_0.16_320)]/80"
                  style={{ width: `${s.pct}%` }}
                />
              </div>
              <p className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
                {s.value.toLocaleString()}
              </p>
              <p className="w-10 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
                {s.pct}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
