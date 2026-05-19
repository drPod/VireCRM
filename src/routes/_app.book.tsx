import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Loader2, RefreshCw } from "lucide-react";
import { RouteError } from "@/components/RouteError";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Clients tab — closed deals (status=won). Read-only. The renewal-hunt
// view: sorted by contract_end_date ascending so the soonest expiring
// contracts surface first, with quick filters for supplier and expiry
// window (90/60/30 days = the broker's "start dialing" milestones).

interface ClientRow {
  id: string;
  name: string;
  deal_name: string | null;
  service_address: string | null;
  esi_id: string | null;
  annual_kwh: number | null;
  current_supplier: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  cost_per_kwh: number | null;
  agent_mils: number | null;
  commission_value: number | null;
}

type ExpiryWindow = "all" | "90" | "60" | "30" | "expired";

export const Route = createFileRoute("/_app/book")({
  component: BookPage,
  errorComponent: (props) => <RouteError {...props} label="Couldn't load clients" />,
  head: () => ({
    meta: [
      { title: "Clients — VireCRM" },
      {
        name: "description",
        content: "Closed deals — your book of business sorted by renewal date.",
      },
    ],
  }),
});

function BookPage() {
  const { organization } = useAuth();
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [expiryWindow, setExpiryWindow] = useState<ExpiryWindow>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, name, deal_name, service_address, esi_id, annual_kwh, current_supplier, contract_start_date, contract_end_date, cost_per_kwh, agent_mils, commission_value",
      )
      .eq("organization_id", organization.id)
      .eq("status", "won")
      .order("contract_end_date", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (error) toast.error(error.message);
    setRows((data || []) as ClientRow[]);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.current_supplier) set.add(r.current_supplier);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = (() => {
      if (expiryWindow === "all" || expiryWindow === "expired") return null;
      const d = new Date(today);
      d.setDate(d.getDate() + Number(expiryWindow));
      return d;
    })();
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (supplierFilter !== "all" && r.current_supplier !== supplierFilter) return false;
      if (expiryWindow !== "all") {
        if (!r.contract_end_date) return false;
        const end = new Date(r.contract_end_date);
        end.setHours(0, 0, 0, 0);
        if (expiryWindow === "expired") {
          if (end >= today) return false;
        } else if (horizon) {
          if (end < today || end > horizon) return false;
        }
      }
      if (needle) {
        const blob = [r.name, r.deal_name, r.service_address, r.esi_id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!blob.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, supplierFilter, expiryWindow, search]);

  const bookCommission = useMemo(
    () => filtered.reduce((s, r) => s + (Number(r.commission_value) || 0), 0),
    [filtered],
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your book of business. Sorted by renewal date — the deals expiring soonest sit at the
            top so they&rsquo;re first in line for the renewal call.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            Book commission
          </div>
          <p className="text-xl font-bold text-foreground mt-1 tabular-nums">
            {formatUsd(bookCommission)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer, deal, address, ESI…"
          className="h-9 w-full sm:w-72"
          aria-label="Search clients"
        />
        <FilterChip label="Renews within">
          <select
            aria-label="Expiry window"
            value={expiryWindow}
            onChange={(e) => setExpiryWindow(e.target.value as ExpiryWindow)}
            className={selectClass}
          >
            <option value="all">Any time</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="expired">Already expired</option>
          </select>
        </FilterChip>
        <FilterChip label="Supplier">
          <select
            aria-label="Supplier filter"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterChip>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void load()}
          className="ml-auto"
          disabled={loading}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Active clients</h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {filtered.length} of {rows.length}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />
            Loading clients…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-foreground">
              {rows.length === 0
                ? "No closed deals yet."
                : "No deals match the current filters."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {rows.length === 0
                ? "Mark a deal Won from the Pricing tab and it will appear here."
                : "Clear the filters above to see your full book."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Deal</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Service address</th>
                  <th className="px-3 py-2.5 font-medium">ESI</th>
                  <th className="px-3 py-2.5 font-medium text-right">Annual kWh</th>
                  <th className="px-3 py-2.5 font-medium">Supplier</th>
                  <th className="px-3 py-2.5 font-medium">Contract start</th>
                  <th className="px-3 py-2.5 font-medium">Contract end</th>
                  <th className="px-3 py-2.5 font-medium text-right">Rate ($/kWh)</th>
                  <th className="px-3 py-2.5 font-medium text-right">Mils</th>
                  <th className="px-3 py-2.5 font-medium text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-foreground">{r.deal_name || "—"}</td>
                    <td className="px-3 py-2 text-foreground">{r.name}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[14rem] truncate">
                      {r.service_address || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                      {r.esi_id || "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">
                      {r.annual_kwh != null ? r.annual_kwh.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.current_supplier ? (
                        <Badge variant="outline">{r.current_supplier}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.contract_start_date
                        ? new Date(r.contract_start_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <RenewalCell isoDate={r.contract_end_date} />
                    </td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">
                      {r.cost_per_kwh != null ? Number(r.cost_per_kwh).toFixed(5) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">
                      {r.agent_mils != null ? Number(r.agent_mils).toFixed(3) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">
                      {r.commission_value != null
                        ? formatUsd(Number(r.commission_value))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const selectClass =
  "h-8 rounded-md border border-input bg-input px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring";

function FilterChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-2 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function RenewalCell({ isoDate }: { isoDate: string | null }) {
  if (!isoDate) return <span className="text-muted-foreground">—</span>;
  const end = new Date(isoDate);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const days = Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const label = end.toLocaleDateString();
  let tone: "destructive" | "warning" | "default" | "outline" = "outline";
  let suffix = "";
  if (days < 0) {
    tone = "destructive";
    suffix = `Expired ${-days}d ago`;
  } else if (days <= 30) {
    tone = "destructive";
    suffix = `in ${days}d`;
  } else if (days <= 90) {
    tone = "warning";
    suffix = `in ${days}d`;
  } else {
    tone = "outline";
    suffix = `in ${days}d`;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-foreground">{label}</span>
      <Badge variant={tone} className="w-fit text-[10px]">
        {suffix}
      </Badge>
    </div>
  );
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
