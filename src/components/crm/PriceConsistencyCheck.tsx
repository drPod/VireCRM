import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { crmTiers, whiteLabelTiers, type PricingTier } from "@/components/marketing/PricingCards";
import {
  clearOverrides,
  formatCentsForDisplay,
  loadOverrides,
  saveOverrides,
  type PriceOverrideMap,
} from "@/lib/pricing-overrides";

type CheckStatus = "match" | "within-tolerance" | "mismatch" | "missing" | "error";

interface CheckRow {
  tier: PricingTier;
  group: "CRM" | "White-Label";
  status: CheckStatus;
  expectedCents: number | null;
  stripeCents: number | null;
  currency: string | null;
  recurring: string | null;
  diffCents: number | null;
  message: string;
  overridden: boolean;
}

/** Parse a tier `price` string like "$39", "$1,499" into integer cents. */
function parsePriceToCents(price: string): number | null {
  const cleaned = price.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "match") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Match
      </Badge>
    );
  }
  if (status === "within-tolerance") {
    return (
      <Badge variant="info" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Within tolerance
      </Badge>
    );
  }
  if (status === "mismatch") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" /> Mismatch
      </Badge>
    );
  }
  if (status === "missing") {
    return (
      <Badge variant="warning" className="gap-1">
        <AlertCircle className="h-3 w-3" /> Skipped
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertCircle className="h-3 w-3" /> Error
    </Badge>
  );
}

function formatCents(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const cur = (currency || "usd").toUpperCase();
  return `${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}

export function PriceConsistencyCheck() {
  const [rows, setRows] = useState<CheckRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [tolerance, setTolerance] = useState<string>("1.00");
  const [overrides, setOverridesState] = useState<PriceOverrideMap>({});
  const env = getStripeEnvironment();

  useEffect(() => {
    setOverridesState(loadOverrides());
    const sync = () => setOverridesState(loadOverrides());
    window.addEventListener("majix:pricing-overrides-changed", sync);
    return () => window.removeEventListener("majix:pricing-overrides-changed", sync);
  }, []);

  const tiers: { tier: PricingTier; group: CheckRow["group"] }[] = [
    ...crmTiers.map((t) => ({ tier: t, group: "CRM" as const })),
    ...whiteLabelTiers.map((t) => ({ tier: t, group: "White-Label" as const })),
  ];

  /** Tolerance in cents. Empty / invalid input = 0 (strict equality). */
  const toleranceCents = (() => {
    const n = Number(tolerance);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  })();

  const runCheck = async () => {
    setRunning(true);
    const out: CheckRow[] = [];
    for (const { tier, group } of tiers) {
      const expectedCents = parsePriceToCents(tier.price);
      const overridden = Boolean(tier.stripePriceId && overrides[tier.stripePriceId]);

      if (!tier.stripePriceId) {
        out.push({
          tier,
          group,
          status: "missing",
          expectedCents,
          stripeCents: null,
          currency: null,
          recurring: null,
          diffCents: null,
          message:
            tier.price.toLowerCase() === "custom"
              ? "Custom quote — no Stripe price configured (expected)"
              : "No stripePriceId configured for this tier",
          overridden: false,
        });
        continue;
      }

      try {
        const { data, error } = await supabase.functions.invoke("get-stripe-price", {
          body: { priceId: tier.stripePriceId, environment: env },
        });
        if (error || !data?.stripeId) {
          out.push({
            tier,
            group,
            status: "error",
            expectedCents,
            stripeCents: null,
            currency: null,
            recurring: null,
            diffCents: null,
            message: error?.message || data?.error || "Failed to resolve Stripe price",
            overridden,
          });
          continue;
        }

        const stripeCents = typeof data.amount === "number" ? data.amount : null;
        const currency = typeof data.currency === "string" ? data.currency : null;
        const recurring = data.recurring?.interval
          ? `every ${data.recurring.interval}`
          : "one-time";

        if (expectedCents == null || stripeCents == null) {
          out.push({
            tier,
            group,
            status: "error",
            expectedCents,
            stripeCents,
            currency,
            recurring,
            diffCents: null,
            message:
              expectedCents == null
                ? `Could not parse displayed price "${tier.price}"`
                : "Stripe did not return a unit_amount",
            overridden,
          });
          continue;
        }

        const diffCents = stripeCents - expectedCents;
        const absDiff = Math.abs(diffCents);

        if (absDiff === 0) {
          out.push({
            tier,
            group,
            status: "match",
            expectedCents,
            stripeCents,
            currency,
            recurring,
            diffCents,
            message: `Displayed ${tier.price}${tier.period} matches Stripe`,
            overridden,
          });
        } else if (absDiff <= toleranceCents) {
          out.push({
            tier,
            group,
            status: "within-tolerance",
            expectedCents,
            stripeCents,
            currency,
            recurring,
            diffCents,
            message: `Δ ${(diffCents / 100).toFixed(2)} ${currency?.toUpperCase() || "USD"} — within ±${(toleranceCents / 100).toFixed(2)} tolerance`,
            overridden,
          });
        } else {
          out.push({
            tier,
            group,
            status: "mismatch",
            expectedCents,
            stripeCents,
            currency,
            recurring,
            diffCents,
            message: `Stripe is ${diffCents >= 0 ? "+" : ""}${(diffCents / 100).toFixed(2)} ${currency?.toUpperCase() || "USD"} vs displayed`,
            overridden,
          });
        }
      } catch (err) {
        out.push({
          tier,
          group,
          status: "error",
          expectedCents,
          stripeCents: null,
          currency: null,
          recurring: null,
          diffCents: null,
          message: err instanceof Error ? err.message : "Unknown error",
          overridden,
        });
      }
    }
    setRows(out);
    setRunning(false);
  };

  const applyAutoUpdate = async () => {
    if (!rows) return;
    const drifted = rows.filter(
      (r) => r.status === "mismatch" && r.tier.stripePriceId && r.stripeCents != null && r.currency,
    );
    if (drifted.length === 0) {
      toast.info("Nothing to update — no tiers exceed the tolerance.");
      return;
    }
    setApplying(true);
    const next: PriceOverrideMap = { ...loadOverrides() };
    for (const r of drifted) {
      const id = r.tier.stripePriceId!;
      next[id] = {
        price: formatCentsForDisplay(r.stripeCents!, r.currency!),
        cents: r.stripeCents!,
        currency: r.currency!,
        updatedAt: new Date().toISOString(),
      };
    }
    saveOverrides(next);
    setOverridesState(next);
    toast.success(
      `Updated ${drifted.length} tier${drifted.length === 1 ? "" : "s"} to match Stripe.`,
    );
    setApplying(false);
    // Re-run so the table reflects the new state.
    void runCheck();
  };

  const resetOverrides = () => {
    clearOverrides();
    setOverridesState({});
    toast.success("Cleared all price overrides — pricing reverted to defaults.");
    if (rows) void runCheck();
  };

  const summary = rows
    ? {
        total: rows.length,
        match: rows.filter((r) => r.status === "match").length,
        withinTolerance: rows.filter((r) => r.status === "within-tolerance").length,
        mismatch: rows.filter((r) => r.status === "mismatch").length,
        missing: rows.filter((r) => r.status === "missing").length,
        error: rows.filter((r) => r.status === "error").length,
      }
    : null;

  const overrideCount = Object.keys(overrides).length;
  const driftedCount = rows?.filter((r) => r.status === "mismatch").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Pricing consistency check
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Verifies displayed CRM tier prices match the configured Stripe price IDs ({env}).
              Auto-update rewrites displayed prices for any tier whose Stripe amount differs by more
              than the tolerance below.
            </p>
            {overrideCount > 0 && (
              <p className="mt-2 text-xs text-info">
                {overrideCount} active price override{overrideCount === 1 ? "" : "s"} applied to the
                marketing page.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="price-tolerance"
                className="text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                Tolerance ($)
              </Label>
              <Input
                id="price-tolerance"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                className="h-9 w-24"
              />
            </div>
            <Button
              onClick={runCheck}
              disabled={running}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {running ? "Checking…" : "Run check"}
            </Button>
            <Button
              onClick={applyAutoUpdate}
              disabled={applying || running || !rows || driftedCount === 0}
              size="sm"
              variant="default"
              className="gap-2"
            >
              {applying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Auto-update {driftedCount > 0 && `(${driftedCount})`}
            </Button>
            <Button
              onClick={resetOverrides}
              disabled={overrideCount === 0}
              size="sm"
              variant="ghost"
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!rows && !running && (
          <p className="text-sm text-muted-foreground">
            Click <strong>Run check</strong> to compare each tier's displayed price against its
            Stripe price. Use tolerance to ignore small rounding differences (e.g. promo math)
            before triggering Auto-update.
          </p>
        )}
        {running && !rows && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Resolving Stripe prices…
          </div>
        )}
        {rows && summary && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Total: {summary.total}</Badge>
              <Badge variant="success">Match: {summary.match}</Badge>
              {summary.withinTolerance > 0 && (
                <Badge variant="info">Within tolerance: {summary.withinTolerance}</Badge>
              )}
              {summary.mismatch > 0 && (
                <Badge variant="destructive">Mismatch: {summary.mismatch}</Badge>
              )}
              {summary.missing > 0 && <Badge variant="warning">Skipped: {summary.missing}</Badge>}
              {summary.error > 0 && <Badge variant="destructive">Errors: {summary.error}</Badge>}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Lookup key</TableHead>
                    <TableHead>Displayed</TableHead>
                    <TableHead>Stripe</TableHead>
                    <TableHead>Δ</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={`${r.group}-${r.tier.name}`}>
                      <TableCell className="font-medium text-foreground">
                        {r.tier.name}
                        {r.overridden && (
                          <Badge variant="info" className="ml-2 text-[10px] px-1.5 py-0">
                            Override
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.group}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.tier.stripePriceId || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.expectedCents != null ? `${r.tier.price}${r.tier.period}` : r.tier.price}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatCents(r.stripeCents, r.currency)}
                        {r.recurring && r.stripeCents != null && (
                          <span className="ml-1 text-muted-foreground">({r.recurring})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.diffCents != null
                          ? `${r.diffCents >= 0 ? "+" : ""}${(r.diffCents / 100).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
