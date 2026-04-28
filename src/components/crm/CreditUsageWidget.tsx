import { useEffect, useState, useCallback } from "react";
import { Zap, Infinity as InfinityIcon, FlaskConical, Loader2, History, RefreshCw } from "lucide-react";
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

interface CreditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  command_id: string | null;
  lead_id: string | null;
  credits_charged: number;
  credits_before: number | null;
  credits_after: number | null;
  quota: number | null;
  unlimited: boolean;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function formatActionLabel(action: string): string {
  return action.replace(/_/g, " ");
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SimulateTierChangeResponse | null>(null);
  const runSimulate = useAuthedServerFn(simulateTierChangeFn);

  // ----- Audit log -----
  const [logOpen, setLogOpen] = useState(false);
  const [logRows, setLogRows] = useState<CreditLogRow[] | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

  const loadLog = useCallback(async () => {
    if (!organizationId) return;
    setLogLoading(true);
    const { data, error } = await supabase
      .from("credit_usage_log")
      .select(
        "id, user_id, action, command_id, lead_id, credits_charged, credits_before, credits_after, quota, unlimited, status, metadata, created_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      toast.error("Could not load credit usage log");
      setLogLoading(false);
      return;
    }

    const rows = (data ?? []) as CreditLogRow[];
    setLogRows(rows);

    const userIds = Array.from(
      new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v && !(v in actorNames))),
    );
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (profiles) {
        setActorNames((prev) => {
          const next = { ...prev };
          for (const p of profiles) next[p.user_id] = p.full_name ?? "Member";
          return next;
        });
      }
    }
    setLogLoading(false);
  }, [organizationId, actorNames]);

  useEffect(() => {
    if (logOpen && logRows === null) loadLog();
  }, [logOpen, logRows, loadLog]);

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

  const runTierTest = async (priceKey: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await runSimulate({ data: { price_key: priceKey, restore: true } });
      setTestResult(res);
      if (res.passed) {
        toast.success(
          `Tier sim OK · ${priceKey} → quota ${res.step.actual.quota}${res.step.actual.unlimited ? " (unlimited)" : ""}`,
        );
      } else {
        toast.error("Tier simulation mismatch — see details");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setTesting(false);
    }
  };

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

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <FlaskConical className="h-3 w-3" /> Tier change simulation
          </p>
          {testing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "crm_starter_monthly", label: "Starter" },
            { key: "crm_growth_monthly", label: "Growth" },
            { key: "crm_pro_monthly", label: "Pro" },
            { key: "crm_ownership_onetime", label: "Ownership" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              disabled={testing}
              onClick={() => runTierTest(t.key)}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              {t.label}
            </button>
          ))}
        </div>
        {testResult && (
          <div
            className={`mt-2 rounded-md border p-2 text-xs ${
              testResult.passed
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-destructive/40 bg-destructive/5 text-destructive"
            }`}
          >
            <div>
              <strong>{testResult.passed ? "✓ Passed" : "✗ Mismatch"}</strong> —{" "}
              {testResult.step.price_key}
            </div>
            <div className="mt-1 text-muted-foreground">
              expected quota {testResult.step.expected.quota}
              {testResult.step.expected.unlimited ? " (∞)" : ""} · got{" "}
              {testResult.step.actual.quota}
              {testResult.step.actual.unlimited ? " (∞)" : ""} · plan{" "}
              {testResult.step.actual.plan}
            </div>
            {testResult.restored && (
              <div className="mt-1 text-muted-foreground">
                restored to {testResult.restored.actual.plan} (quota{" "}
                {testResult.restored.actual.quota})
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setLogOpen((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <History className="h-3 w-3" />
            Recent credit activity
            <span className="text-muted-foreground/60">{logOpen ? "▾" : "▸"}</span>
          </button>
          {logOpen && (
            <button
              type="button"
              onClick={loadLog}
              disabled={logLoading}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${logLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        </div>

        {logOpen && (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {logLoading && logRows === null ? (
              <div className="py-3 text-center text-xs text-muted-foreground">Loading…</div>
            ) : !logRows || logRows.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                No credit activity yet.
              </div>
            ) : (
              logRows.map((row) => {
                const actor = row.user_id
                  ? actorNames[row.user_id] ?? "Member"
                  : "System";
                const isReject = row.status === "rejected_quota";
                const isUnlim = row.status === "bypass_unlimited";
                return (
                  <div
                    key={row.id}
                    className={`rounded-md border p-2 text-xs ${
                      isReject
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground capitalize">
                        {formatActionLabel(row.action)}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          isReject
                            ? "bg-destructive/20 text-destructive"
                            : isUnlim
                              ? "bg-primary/15 text-primary"
                              : "bg-foreground/10 text-foreground"
                        }`}
                      >
                        {isReject
                          ? "Blocked"
                          : isUnlim
                            ? "Unlimited"
                            : `−${row.credits_charged}`}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground">
                      <span>{actor}</span>
                      <span>·</span>
                      <span>{formatRelative(row.created_at)}</span>
                      {row.credits_before !== null && row.credits_after !== null && (
                        <>
                          <span>·</span>
                          <span>
                            {row.credits_before} → {row.credits_after}
                            {row.quota !== null ? ` / ${row.quota}` : ""}
                          </span>
                        </>
                      )}
                    </div>
                    {row.command_id && (
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">
                        cmd: {row.command_id}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
