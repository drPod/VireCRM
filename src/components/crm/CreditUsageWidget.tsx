import { useEffect, useState } from "react";
import { Zap, Infinity as InfinityIcon, FlaskConical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  simulateTierChangeFn,
  type SimulateTierChangeResponse,
} from "@/functions/simulate-tier-change.functions";
import { toast } from "sonner";

interface CreditUsageWidgetProps {
  organizationId?: string;
}

interface CreditState {
  quota: number;
  used: number;
  unlimited: boolean;
  periodStart: string | null;
  plan: string;
  loading: boolean;
}

const INITIAL: CreditState = {
  quota: 0,
  used: 0,
  unlimited: false,
  periodStart: null,
  plan: "starter",
  loading: true,
};

function formatPeriod(iso: string | null): string {
  if (!iso) return "this period";
  const start = new Date(iso);
  return start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function CreditUsageWidget({ organizationId }: CreditUsageWidgetProps) {
  const [state, setState] = useState<CreditState>(INITIAL);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select(
          "monthly_credit_quota, credits_used_this_period, unlimited_credits, credit_period_start, plan",
        )
        .eq("id", organizationId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      setState({
        quota: data.monthly_credit_quota ?? 0,
        used: data.credits_used_this_period ?? 0,
        unlimited: data.unlimited_credits ?? false,
        periodStart: data.credit_period_start ?? null,
        plan: data.plan ?? "starter",
        loading: false,
      });
    };

    load();

    const channel = supabase
      .channel(`org-credits-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "organizations",
          filter: `id=eq.${organizationId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setState({
            quota: (row.monthly_credit_quota as number) ?? 0,
            used: (row.credits_used_this_period as number) ?? 0,
            unlimited: (row.unlimited_credits as boolean) ?? false,
            periodStart: (row.credit_period_start as string) ?? null,
            plan: (row.plan as string) ?? "starter",
            loading: false,
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  if (state.loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="h-24 animate-pulse rounded bg-muted/40" />
      </div>
    );
  }

  const remaining = Math.max(state.quota - state.used, 0);
  const pct = state.quota > 0 ? Math.min((state.used / state.quota) * 100, 100) : 0;
  const lowOnCredits = !state.unlimited && state.quota > 0 && remaining / state.quota < 0.15;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Credit usage</h3>
            <p className="text-xs text-muted-foreground capitalize">
              {state.plan.replace(/_/g, " ")} plan · {formatPeriod(state.periodStart)}
            </p>
          </div>
        </div>
        {state.unlimited && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <InfinityIcon className="h-3 w-3" />
            Unlimited
          </span>
        )}
      </div>

      {state.unlimited ? (
        <div className="space-y-1">
          <p className="text-2xl font-semibold text-foreground">No usage limits</p>
          <p className="text-xs text-muted-foreground">
            Your plan includes unlimited AI commands and outreach sends.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Quota</p>
              <p className="text-lg font-semibold text-foreground">
                {state.quota.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Used</p>
              <p className="text-lg font-semibold text-foreground">
                {state.used.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p
                className={`text-lg font-semibold ${
                  lowOnCredits ? "text-destructive" : "text-foreground"
                }`}
              >
                {remaining.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                lowOnCredits ? "bg-destructive" : "bg-primary"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {pct.toFixed(0)}% used · 1 credit = 1 AI command or email send
          </p>
        </>
      )}
    </div>
  );
}
