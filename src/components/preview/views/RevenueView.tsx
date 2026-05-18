import { ArrowUpRight, Download, TrendingUp } from "lucide-react";
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
import { REVENUE, REVENUE_TOTALS } from "../data/revenue";

export function RevenueView() {
  const max = Math.max(...REVENUE.map((r) => r.mrr));
  const min = Math.min(...REVENUE.map((r) => r.mrr));
  const padded = max + (max - min) * 0.1;

  const points = REVENUE.map((r, i) => {
    const x = (i / (REVENUE.length - 1)) * 100;
    const y = 100 - ((r.mrr - min) / (padded - min)) * 100;
    return { x, y, ...r };
  });

  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const area = `${path} L 100 100 L 0 100 Z`;

  const lastMrr = REVENUE[REVENUE.length - 1].mrr;
  const prevMrr = REVENUE[REVENUE.length - 2].mrr;
  const mom = ((lastMrr - prevMrr) / prevMrr) * 100;

  return (
    <div data-tour="revenue" className="space-y-6 scroll-mt-24">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">MRR</p>
          <p className="mt-1 text-2xl font-bold text-foreground">${lastMrr.toLocaleString()}</p>
          <p className="text-xs text-success">+{mom.toFixed(1)}% MoM</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">ARR</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            ${REVENUE_TOTALS.arr.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">LTV : CAC</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {(REVENUE_TOTALS.ltv / REVENUE_TOTALS.cac).toFixed(1)}×
          </p>
          <p className="text-xs text-muted-foreground">
            ${REVENUE_TOTALS.ltv.toLocaleString()} / ${REVENUE_TOTALS.cac.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Payback</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{REVENUE_TOTALS.payback} mo</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">MRR — last 12 months</h3>
            <p className="text-xs text-muted-foreground">
              Recurring revenue, ex-one-time + ex-tax
            </p>
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
                  Export CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign up to export revenue data.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="p-5">
          <div className="relative h-48 w-full">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.55 0.18 290)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="oklch(0.55 0.18 290)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#rev-grad)" />
              <path
                d={path}
                fill="none"
                stroke="oklch(0.55 0.18 290)"
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === points.length - 1 ? 1.2 : 0.6}
                  fill={i === points.length - 1 ? "oklch(0.55 0.18 290)" : "oklch(0.55 0.18 290 / 0.8)"}
                />
              ))}
            </svg>
          </div>
          <div className="mt-3 grid grid-cols-12 gap-1 text-center">
            {REVENUE.map((r) => (
              <p key={r.month} className="text-[10px] text-muted-foreground">
                {r.month}
              </p>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border/60 px-5 py-3">
          <h3 className="text-base font-semibold text-foreground">Monthly breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Month</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="text-right">New MRR</TableHead>
                <TableHead className="text-right">Expansion</TableHead>
                <TableHead className="text-right">Churn</TableHead>
                <TableHead className="text-right">Net Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REVENUE.map((r) => {
                const net = r.newMrr + r.expansion - r.churn;
                return (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium text-foreground">{r.month}</TableCell>
                    <TableCell className="text-right text-foreground">${r.mrr.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-success">+${r.newMrr.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-success">+${r.expansion.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive">−${r.churn.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span className={`inline-flex items-center gap-1 ${net >= 0 ? "text-success" : "text-destructive"}`}>
                        {net >= 0 && <ArrowUpRight className="h-3 w-3" />}
                        {net >= 0 ? "+" : ""}${net.toLocaleString()}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">AI forecast — next quarter</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Based on weighted conversion probabilities across your pipeline.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ForecastTile label="Low" value="$108,400" tone="muted" />
          <ForecastTile label="Likely" value="$124,800" tone="primary" />
          <ForecastTile label="High" value="$141,600" tone="success" />
        </div>
      </Card>
    </div>
  );
}

function ForecastTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "muted" | "primary" | "success";
}) {
  const cls =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "success"
        ? "border-success/30 bg-success/5"
        : "border-border bg-card/60";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
