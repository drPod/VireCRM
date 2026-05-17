import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Settings as SettingsIcon,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, formatCompactMoney } from "@/lib/money";
import { toast } from "sonner";
import { CommissionRulesDialog } from "@/components/crm/CommissionRulesDialog";

interface EarningRow {
  id: string;
  user_id: string;
  lead_id: string | null;
  deal_value_cents: number;
  commission_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  payment_reference: string | null;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
}

interface LeadLite {
  id: string;
  name: string;
  company: string | null;
}

function PayoutsErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Couldn't load payouts</p>
            <p className="text-xs text-muted-foreground mt-1">{error?.message}</p>
          </div>
        </div>
        <Button
          variant="command"
          size="sm"
          className="mt-4"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/payouts")({
  component: PayoutsPage,
  errorComponent: PayoutsErrorComponent,
  head: () => ({
    meta: [
      { title: "Team Payouts — Majix" },
      {
        name: "description",
        content: "Track and pay out commissions earned by your sales team on closed deals.",
      },
    ],
  }),
});

function PayoutsPage() {
  const { organization, role, user } = useAuth();
  const isOwner = role?.role === "owner";
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
  const [leadsById, setLeadsById] = useState<Record<string, LeadLite>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("pending");
  const [rulesOpen, setRulesOpen] = useState(false);

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);

    let q = supabase
      .from("commission_earnings")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });

    // Reps see only their own; RLS enforces this server-side too
    if (!isOwner && user?.id) {
      q = q.eq("user_id", user.id);
    }

    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data || []) as EarningRow[];
    setEarnings(rows);

    // Hydrate rep names + lead names
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const leadIds = Array.from(new Set(rows.map((r) => r.lead_id).filter(Boolean) as string[]));

    const [profilesRes, leadsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : Promise.resolve({ data: [] as ProfileLite[] }),
      leadIds.length > 0
        ? supabase.from("leads").select("id, name, company").in("id", leadIds)
        : Promise.resolve({ data: [] as LeadLite[] }),
    ]);
    const pMap: Record<string, ProfileLite> = {};
    (profilesRes.data || []).forEach((p) => {
      pMap[p.user_id] = p as ProfileLite;
    });
    setProfilesById(pMap);

    const lMap: Record<string, LeadLite> = {};
    (leadsRes.data || []).forEach((l) => {
      lMap[l.id] = l as LeadLite;
    });
    setLeadsById(lMap);

    setLoading(false);
  }, [organization?.id, isOwner, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = earnings.filter((e) => filter === "all" || e.status === filter);

  // Summary across the visible (filtered, RLS-scoped) rows
  const totalPending = earnings
    .filter((e) => e.status === "pending")
    .reduce((s, e) => s + e.commission_cents, 0);
  const totalPaid = earnings
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + e.commission_cents, 0);
  const lifetime = earnings
    .filter((e) => e.status !== "void")
    .reduce((s, e) => s + e.commission_cents, 0);

  // Rep leaderboard (owners only)
  const leaderboard = isOwner
    ? Object.entries(
        earnings
          .filter((e) => e.status !== "void")
          .reduce<Record<string, number>>((acc, e) => {
            acc[e.user_id] = (acc[e.user_id] || 0) + e.commission_cents;
            return acc;
          }, {}),
      )
        .map(([userId, cents]) => ({
          userId,
          cents,
          name: profilesById[userId]?.full_name || "Unknown rep",
        }))
        .sort((a, b) => b.cents - a.cents)
        .slice(0, 5)
    : [];

  const markPaid = async (earningId: string) => {
    const { data, error } = await supabase.rpc("mark_earning_paid", {
      p_earning_id: earningId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { success: boolean; error?: string };
    if (result?.success) {
      toast.success("Marked as paid");
      load();
    } else {
      toast.error(result?.error || "Failed to mark as paid");
    }
  };

  const exportCsv = () => {
    const header = [
      "Date",
      "Rep",
      "Lead",
      "Deal value",
      "Commission",
      "Currency",
      "Status",
      "Paid at",
      "Reference",
    ];
    const rows = filtered.map((e) => [
      new Date(e.created_at).toISOString(),
      profilesById[e.user_id]?.full_name || e.user_id,
      e.lead_id ? leadsById[e.lead_id]?.name || e.lead_id : "",
      (e.deal_value_cents / 100).toFixed(2),
      (e.commission_cents / 100).toFixed(2),
      e.currency,
      e.status,
      e.paid_at ? new Date(e.paid_at).toISOString() : "",
      e.payment_reference || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isOwner ? "Team Payouts" : "Your Earnings"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isOwner
              ? "Commissions earned on closed deals — mark as paid when settled."
              : "Commissions you've earned from deals you closed."}
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setRulesOpen(true)}>
              <SettingsIcon className="mr-1.5 h-3.5 w-3.5" />
              Commission Rules
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Clock}
          label={isOwner ? "Pending payouts" : "Pending earnings"}
          value={formatCompactMoney(totalPending)}
          tone="warning"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Paid out"
          value={formatCompactMoney(totalPaid)}
          tone="success"
        />
        <SummaryCard
          icon={TrendingUp}
          label={isOwner ? "Lifetime team commissions" : "Lifetime earnings"}
          value={formatCompactMoney(lifetime)}
          tone="primary"
        />
      </div>

      {/* Leaderboard for owners */}
      {isOwner && leaderboard.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-3">Top earners</h2>
          <div className="space-y-2">
            {leaderboard.map((row, idx) => (
              <div key={row.userId} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-foreground flex-1 truncate">
                  {row.name}
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {formatMoney(row.cents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["pending", "paid", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              filter === f
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Earnings table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Wallet className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-foreground">
              No {filter === "all" ? "" : filter} earnings yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isOwner
                ? "Set up a commission rule and close a deal to see earnings here."
                : "Earnings appear when you close a lead with a deal value set."}
            </p>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setRulesOpen(true)}
              >
                Set up commission rule
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  {isOwner && <th className="px-4 py-2.5 font-medium">Rep</th>}
                  <th className="px-4 py-2.5 font-medium">Lead</th>
                  <th className="px-4 py-2.5 font-medium text-right">Deal value</th>
                  <th className="px-4 py-2.5 font-medium text-right">Commission</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  {isOwner && <th className="px-4 py-2.5 font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((e) => {
                  const repName = profilesById[e.user_id]?.full_name || "Unknown";
                  const lead = e.lead_id ? leadsById[e.lead_id] : null;
                  return (
                    <tr key={e.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(e.created_at).toLocaleDateString()}
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 font-medium text-foreground">{repName}</td>
                      )}
                      <td className="px-4 py-3">
                        {lead ? (
                          <div>
                            <p className="text-foreground">{lead.name}</p>
                            {lead.company && (
                              <p className="text-xs text-muted-foreground">{lead.company}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">deleted lead</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatMoney(e.deal_value_cents, e.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                        {formatMoney(e.commission_cents, e.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={e.status} />
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 text-right">
                          {e.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => markPaid(e.id)}>
                              Mark paid
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isOwner && (
        <p className="text-xs text-muted-foreground text-center">
          Only owners can mark earnings as paid. Reach out to your admin if something looks off.{" "}
          <Link to="/revenue" className="underline">
            Revenue dashboard →
          </Link>
        </p>
      )}

      {isOwner && (
        <CommissionRulesDialog
          open={rulesOpen}
          onOpenChange={setRulesOpen}
          organizationId={organization?.id || ""}
          onSaved={load}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "warning" | "success" | "primary";
}) {
  const toneClass =
    tone === "warning"
      ? "bg-warning/10 text-warning"
      : tone === "success"
        ? "bg-success/10 text-success"
        : "bg-primary/10 text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground mt-3">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <Badge variant="outline" className="border-success/30 text-success">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Paid
      </Badge>
    );
  }
  if (status === "void") {
    return <Badge variant="outline">Void</Badge>;
  }
  return (
    <Badge variant="outline" className="border-warning/30 text-warning">
      <Clock className="mr-1 h-3 w-3" /> Pending
    </Badge>
  );
}
