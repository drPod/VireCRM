import { useEffect, useState } from "react";
import { Trophy, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WeekBucket {
  weekStart: Date;
  count: number;
  valueCents: number;
}

interface WonSummary {
  loading: boolean;
  totalWon: number;
  totalValueCents: number;
  currency: string;
  weeks: WeekBucket[];
  weekWonThis: number;
  weekValueThisCents: number;
  avgDealCents: number;
}

const EMPTY: WonSummary = {
  loading: true,
  totalWon: 0,
  totalValueCents: 0,
  currency: "USD",
  weeks: [],
  weekWonThis: 0,
  weekValueThisCents: 0,
  avgDealCents: 0,
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: cents >= 100_000_00 ? 0 : 2,
  }).format(cents / 100);
}

export function WonDealsWidget({ organizationId }: { organizationId: string | null | undefined }) {
  const [data, setData] = useState<WonSummary>(EMPTY);

  useEffect(() => {
    if (!organizationId) {
      setData({ ...EMPTY, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      setData((prev) => ({ ...prev, loading: true }));
      const now = new Date();
      const twelveWeeksAgo = new Date(now.getTime() - 12 * WEEK_MS);

      const { data: rows } = await supabase
        .from("leads")
        .select("deal_value_cents, deal_currency, closed_at, updated_at")
        .eq("organization_id", organizationId)
        .eq("status", "won")
        .limit(2000);

      if (cancelled) return;

      const weeks: WeekBucket[] = Array.from({ length: 12 }, (_, i) => ({
        weekStart: new Date(twelveWeeksAgo.getTime() + i * WEEK_MS),
        count: 0,
        valueCents: 0,
      }));

      let totalWon = 0;
      let totalValueCents = 0;
      let currency = "USD";
      let weekWonThis = 0;
      let weekValueThisCents = 0;
      const currentWeekStart = new Date(now.getTime() - WEEK_MS);

      for (const row of rows ?? []) {
        const cents = Number(row.deal_value_cents ?? 0);
        const cur = row.deal_currency || "USD";
        if (cur && cur !== "USD") currency = cur;
        totalWon += 1;
        totalValueCents += cents;

        const closedTs = row.closed_at ?? row.updated_at;
        if (!closedTs) continue;
        const t = new Date(closedTs).getTime();
        if (t >= currentWeekStart.getTime()) {
          weekWonThis += 1;
          weekValueThisCents += cents;
        }
        const idx = Math.floor((t - twelveWeeksAgo.getTime()) / WEEK_MS);
        if (idx >= 0 && idx < 12) {
          weeks[idx].count += 1;
          weeks[idx].valueCents += cents;
        }
      }

      setData({
        loading: false,
        totalWon,
        totalValueCents,
        currency,
        weeks,
        weekWonThis,
        weekValueThisCents,
        avgDealCents: totalWon > 0 ? Math.round(totalValueCents / totalWon) : 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const maxVal = Math.max(1, ...data.weeks.map((w) => w.valueCents));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/15">
            <Trophy className="h-4 w-4 text-success" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Won Deals</h3>
        </div>
        <span className="text-xs text-muted-foreground">Last 12 weeks</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Deals won</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {data.loading ? "—" : data.totalWon}
          </p>
          {data.weekWonThis > 0 && (
            <p className="mt-0.5 text-[11px] text-success flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />+{data.weekWonThis} this week
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total value</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {data.loading ? "—" : formatMoney(data.totalValueCents, data.currency)}
          </p>
          {data.weekValueThisCents > 0 && (
            <p className="mt-0.5 text-[11px] text-success">
              +{formatMoney(data.weekValueThisCents, data.currency)} this week
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Avg deal</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {data.loading ? "—" : formatMoney(data.avgDealCents, data.currency)}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Weekly deal value</p>
        {data.totalWon === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No closed deals yet. Mark a lead as won to start tracking.
          </p>
        ) : (
          <div className="flex items-end gap-1 h-20">
            {data.weeks.map((w) => {
              const pct = (w.valueCents / maxVal) * 100;
              return (
                <div
                  key={w.weekStart.toISOString()}
                  className="flex-1 rounded-t bg-success/70 transition-all hover:bg-success min-h-[2px]"
                  style={{ height: `${Math.max(pct, w.count > 0 ? 6 : 0)}%` }}
                  title={`Week of ${w.weekStart.toLocaleDateString()} — ${w.count} deal${w.count === 1 ? "" : "s"}, ${formatMoney(w.valueCents, data.currency)}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
