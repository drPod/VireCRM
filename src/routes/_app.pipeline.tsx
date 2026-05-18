import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, DollarSign, Loader2, Sparkles } from "lucide-react";
import { RouteError } from "@/components/RouteError";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Pricing tab — leads currently in `negotiation` (the stage just before
// `won`). Agents set the supplier rate (cost_per_kwh) and their commission
// (agent_mils) here; commission_value is a generated PG column that updates
// the moment the row is saved. Once the agent clicks "Mark Won" the lead
// moves to the Clients tab (status=won).

interface PipelineRow {
  id: string;
  name: string;
  deal_name: string | null;
  service_address: string | null;
  esi_id: string | null;
  annual_kwh: number | null;
  current_supplier: string | null;
  contract_end_date: string | null;
  cost_per_kwh: number | null;
  agent_mils: number | null;
  commission_value: number | null;
}

export const Route = createFileRoute("/_app/pipeline")({
  component: PipelinePage,
  errorComponent: (props) => <RouteError {...props} label="Couldn't load pipeline" />,
  head: () => ({
    meta: [
      { title: "Pricing — Majix" },
      {
        name: "description",
        content: "Deals in pricing — set supplier rate and agent mils, then mark won.",
      },
    ],
  }),
});

function PipelinePage() {
  const { organization } = useAuth();
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [winningId, setWinningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, name, deal_name, service_address, esi_id, annual_kwh, current_supplier, contract_end_date, cost_per_kwh, agent_mils, commission_value",
      )
      .eq("organization_id", organization.id)
      .eq("status", "negotiation")
      .order("contract_end_date", { ascending: true, nullsFirst: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data || []) as PipelineRow[]);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPipelineCommission = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.commission_value) || 0), 0),
    [rows],
  );

  const saveCell = async (
    id: string,
    field: "cost_per_kwh" | "agent_mils",
    raw: string,
  ): Promise<void> => {
    const trimmed = raw.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      toast.error(`Invalid ${field === "cost_per_kwh" ? "rate" : "mils"} — must be ≥ 0`);
      return;
    }
    setSavingId(id);
    const patch =
      field === "cost_per_kwh" ? { cost_per_kwh: next } : { agent_mils: next };
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  };

  const markWon = async (id: string) => {
    setWinningId(id);
    const { error } = await supabase.from("leads").update({ status: "won" }).eq("id", id);
    setWinningId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deal moved to Clients");
    await load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pricing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deals in pricing. Set the supplier rate and your agent mils, then mark them won when
            the customer signs.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Pipeline commission
          </div>
          <p className="text-xl font-bold text-foreground mt-1 tabular-nums">
            {formatUsd(totalPipelineCommission)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">In pricing</h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {rows.length} deal{rows.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />
            Loading pricing pipeline…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <DollarSign className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-foreground">No deals in pricing right now.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Move a lead to <span className="font-medium">Negotiation</span> stage and it will
              appear here.
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
                  <th className="px-3 py-2.5 font-medium">Contract end</th>
                  <th className="px-3 py-2.5 font-medium text-right">Rate ($/kWh)</th>
                  <th className="px-3 py-2.5 font-medium text-right">Mils</th>
                  <th className="px-3 py-2.5 font-medium text-right">Commission</th>
                  <th className="px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const isSaving = savingId === r.id;
                  const isWinning = winningId === r.id;
                  return (
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
                        {r.contract_end_date
                          ? new Date(r.contract_end_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          step="0.00001"
                          min={0}
                          defaultValue={r.cost_per_kwh ?? ""}
                          aria-label={`Rate per kWh for ${r.deal_name || r.name}`}
                          className="h-8 w-24 text-right tabular-nums"
                          disabled={isSaving || isWinning}
                          onBlur={(e) => {
                            const next = e.target.value;
                            if ((next || null) === (r.cost_per_kwh?.toString() || null)) return;
                            void saveCell(r.id, "cost_per_kwh", next);
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          step="0.001"
                          min={0}
                          defaultValue={r.agent_mils ?? ""}
                          aria-label={`Agent mils for ${r.deal_name || r.name}`}
                          className="h-8 w-20 text-right tabular-nums"
                          disabled={isSaving || isWinning}
                          onBlur={(e) => {
                            const next = e.target.value;
                            if ((next || null) === (r.agent_mils?.toString() || null)) return;
                            void saveCell(r.id, "agent_mils", next);
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">
                        {r.commission_value != null
                          ? formatUsd(Number(r.commission_value))
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="command"
                          disabled={isSaving || isWinning}
                          onClick={() => void markWon(r.id)}
                        >
                          {isWinning ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          )}
                          Mark Won
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
