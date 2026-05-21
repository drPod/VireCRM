import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MonthBucket {
  month: string; // "Jan 2025"
  monthKey: string; // "2025-01"
  revenue: number; // cents
  expenses: number; // cents
  deals: number;
}

export interface RevenueMetrics {
  loading: boolean;
  // Headline numbers (all in cents)
  mrrCents: number;
  arrCents: number;
  totalRevenueCents: number; // last 12 months
  totalExpensesCents: number; // last 12 months
  netProfitCents: number; // revenue - expenses
  arpuCents: number; // avg revenue per closed deal (last 12 mo)
  closedDealCount: number; // last 12 months
  wonRate: number; // 0-1 — won / (won+lost) over last 12mo
  monthly: MonthBucket[];
}

const EMPTY: RevenueMetrics = {
  loading: true,
  mrrCents: 0,
  arrCents: 0,
  totalRevenueCents: 0,
  totalExpensesCents: 0,
  netProfitCents: 0,
  arpuCents: 0,
  closedDealCount: 0,
  wonRate: 0,
  monthly: [],
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function useRevenueMetrics(organizationId: string | undefined): RevenueMetrics {
  const [metrics, setMetrics] = useState<RevenueMetrics>(EMPTY);

  useEffect(() => {
    if (!organizationId) {
      setMetrics({ ...EMPTY, loading: false });
      return;
    }

    let cancelled = false;
    (async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const startIso = start.toISOString();
      const startDate = startIso.slice(0, 10);

      // Build month buckets for the last 12 months
      const buckets: MonthBucket[] = [];
      const byKey = new Map<string, MonthBucket>();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const b: MonthBucket = {
          month: monthLabel(d),
          monthKey: monthKey(d),
          revenue: 0,
          expenses: 0,
          deals: 0,
        };
        buckets.push(b);
        byKey.set(b.monthKey, b);
      }

      const [wonLeadsRes, lostLeadsRes, expensesRes] = await Promise.all([
        supabase
          .from("leads")
          .select("deal_value_cents, closed_at, status")
          .eq("organization_id", organizationId)
          .eq("status", "won")
          .gte("closed_at", startIso),
        supabase
          .from("leads")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("status", "lost")
          .gte("updated_at", startIso),
        supabase
          .from("expenses")
          .select("amount_cents, incurred_at")
          .eq("organization_id", organizationId)
          .gte("incurred_at", startDate),
      ]);

      if (cancelled) return;

      let totalRevenue = 0;
      let totalExpenses = 0;
      let dealCount = 0;
      let currentMonthRevenue = 0;
      const currentKey = monthKey(now);

      (wonLeadsRes.data || []).forEach((l) => {
        const cents = Number(l.deal_value_cents || 0);
        if (!l.closed_at) return;
        const d = new Date(l.closed_at);
        const k = monthKey(d);
        const bucket = byKey.get(k);
        if (bucket) {
          bucket.revenue += cents;
          bucket.deals += 1;
        }
        totalRevenue += cents;
        dealCount += 1;
        if (k === currentKey) currentMonthRevenue += cents;
      });

      (expensesRes.data || []).forEach((e) => {
        const cents = Number(e.amount_cents || 0);
        const d = new Date(e.incurred_at);
        const k = monthKey(d);
        const bucket = byKey.get(k);
        if (bucket) bucket.expenses += cents;
        totalExpenses += cents;
      });

      const wonCount = wonLeadsRes.data?.length || 0;
      const lostCount = lostLeadsRes.data?.length || 0;
      const wonRate = wonCount + lostCount > 0 ? wonCount / (wonCount + lostCount) : 0;

      // MRR proxy: current month closed-deal revenue. ARR = MRR * 12.
      const mrr = currentMonthRevenue;
      const arr = mrr * 12;

      setMetrics({
        loading: false,
        mrrCents: mrr,
        arrCents: arr,
        totalRevenueCents: totalRevenue,
        totalExpensesCents: totalExpenses,
        netProfitCents: totalRevenue - totalExpenses,
        arpuCents: dealCount > 0 ? Math.round(totalRevenue / dealCount) : 0,
        closedDealCount: dealCount,
        wonRate,
        monthly: buckets,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return metrics;
}
