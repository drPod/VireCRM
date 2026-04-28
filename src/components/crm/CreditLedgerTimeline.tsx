import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coins, ArrowDownCircle, ArrowUpCircle, Clock, AlertCircle, Loader2, History } from "lucide-react";
import { CREDIT_PACKS } from "./CreditTopUpPanel";

interface Props {
  organizationId: string;
}

type LedgerEntry = {
  id: string;
  at: string;
  kind: "purchase" | "usage_quota" | "usage_pack" | "expiry";
  delta: number; // positive = added, negative = consumed
  label: string;
  detail?: string;
  meta?: string;
  receiptUrl?: string | null;
};

const PAGE_SIZE = 25;

function packLabel(key: string): string {
  return CREDIT_PACKS.find((p) => p.key === key)?.label ?? key;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CreditLedgerTimeline({ organizationId }: Props) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "purchase" | "usage" | "expiry">("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);

    // Pull pack purchases + usage log + expired packs in parallel.
    const [packsRes, usageRes] = await Promise.all([
      supabase
        .from("credit_packs")
        .select("id, pack_key, credits_total, credits_remaining, purchased_at, expires_at, amount_cents, source")
        .eq("organization_id", organizationId)
        .order("purchased_at", { ascending: false })
        .limit(200),
      supabase
        .from("credit_usage_log")
        .select("id, action, command_id, credits_charged, credits_before, credits_after, unlimited, status, metadata, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const merged: LedgerEntry[] = [];

    for (const p of packsRes.data ?? []) {
      const pack = p as {
        id: string;
        pack_key: string;
        credits_total: number;
        credits_remaining: number;
        purchased_at: string;
        expires_at: string;
        amount_cents: number | null;
        source: string;
      };
      // Purchase entry
      merged.push({
        id: `pack-${pack.id}`,
        at: pack.purchased_at,
        kind: "purchase",
        delta: pack.credits_total,
        label: `${packLabel(pack.pack_key)} pack purchased`,
        detail: pack.amount_cents != null ? `$${(pack.amount_cents / 100).toFixed(2)} · ${pack.credits_total.toLocaleString()} credits` : `${pack.credits_total.toLocaleString()} credits`,
        meta: pack.source === "auto_recharge" ? "auto-recharge" : undefined,
      });

      // Expiry entry — only if already expired with credits left unconsumed
      const expired = new Date(pack.expires_at).getTime() < Date.now();
      if (expired && pack.credits_remaining > 0) {
        merged.push({
          id: `exp-${pack.id}`,
          at: pack.expires_at,
          kind: "expiry",
          delta: -pack.credits_remaining,
          label: `${packLabel(pack.pack_key)} pack expired`,
          detail: `${pack.credits_remaining.toLocaleString()} unused credits forfeited`,
        });
      }
    }

    for (const u of usageRes.data ?? []) {
      const row = u as {
        id: string;
        action: string;
        command_id: string | null;
        credits_charged: number;
        credits_before: number | null;
        credits_after: number | null;
        unlimited: boolean;
        status: string;
        metadata: Record<string, unknown> | null;
        created_at: string;
      };
      const fromPack = (row.metadata as { source?: string } | null)?.source === "pack";
      if (row.status !== "consumed") continue;
      merged.push({
        id: `use-${row.id}`,
        at: row.created_at,
        kind: fromPack ? "usage_pack" : "usage_quota",
        delta: -row.credits_charged,
        label: row.action.replace(/_/g, " "),
        detail: row.command_id ? `Command: ${row.command_id}` : undefined,
        meta: fromPack ? "from pack" : row.unlimited ? "unlimited" : "from quota",
      });
    }

    merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setEntries(merged);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = entries.filter((e) => {
    if (filter === "all") return true;
    if (filter === "purchase") return e.kind === "purchase";
    if (filter === "usage") return e.kind === "usage_quota" || e.kind === "usage_pack";
    if (filter === "expiry") return e.kind === "expiry";
    return true;
  });

  const shown = filtered.slice(0, visible);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold text-foreground">Credits ledger</h3>
            <p className="text-xs text-muted-foreground">
              Every purchase, usage event, and expiry — newest first.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1 text-xs">
          {(["all", "purchase", "usage", "expiry"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setVisible(PAGE_SIZE);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors capitalize ${
                filter === f
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <Coins className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No ledger entries yet.
        </div>
      ) : (
        <>
          <ol className="relative border-l border-border/60 ml-2 space-y-4">
            {shown.map((e) => {
              const positive = e.delta > 0;
              const Icon =
                e.kind === "purchase"
                  ? ArrowUpCircle
                  : e.kind === "expiry"
                  ? AlertCircle
                  : ArrowDownCircle;
              const tone =
                e.kind === "purchase"
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  : e.kind === "expiry"
                  ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                  : e.kind === "usage_pack"
                  ? "text-violet-400 bg-violet-500/10 border-violet-500/30"
                  : "text-primary bg-primary/10 border-primary/30";
              return (
                <li key={e.id} className="ml-5 relative">
                  <span className={`absolute -left-[34px] top-0 flex h-6 w-6 items-center justify-center rounded-full border ${tone}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground capitalize">{e.label}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <Clock className="h-3 w-3" />
                        <span title={formatDateTime(e.at)}>{formatRelative(e.at)}</span>
                        {e.detail && <span className="text-muted-foreground/60">·</span>}
                        {e.detail && <span>{e.detail}</span>}
                        {e.meta && (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <span className="px-1.5 py-0.5 rounded bg-muted/40 text-[10px] uppercase tracking-wider">{e.meta}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm font-mono font-semibold tabular-nums shrink-0 ${positive ? "text-emerald-400" : e.kind === "expiry" ? "text-amber-400" : "text-foreground"}`}>
                      {positive ? "+" : ""}{e.delta.toLocaleString()}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {filtered.length > visible && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="text-xs text-primary hover:text-primary/80 font-medium"
              >
                Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
