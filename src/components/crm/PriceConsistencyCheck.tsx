import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { crmTiers, whiteLabelTiers, type PricingTier } from "@/components/marketing/PricingCards";

type CheckStatus = "match" | "mismatch" | "missing" | "error";

interface CheckRow {
  tier: PricingTier;
  group: "CRM" | "White-Label";
  status: CheckStatus;
  expectedCents: number | null;
  stripeCents: number | null;
  currency: string | null;
  recurring: string | null;
  message: string;
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
        <AlertCircle className="h-3 w-3" /> Missing
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
  const env = getStripeEnvironment();

  const tiers: { tier: PricingTier; group: CheckRow["group"] }[] = [
    ...crmTiers.map((t) => ({ tier: t, group: "CRM" as const })),
    ...whiteLabelTiers.map((t) => ({ tier: t, group: "White-Label" as const })),
  ];

  const runCheck = async () => {
    setRunning(true);
    const out: CheckRow[] = [];
    for (const { tier, group } of tiers) {
      const expectedCents = parsePriceToCents(tier.price);

      // Skip non-checkable tiers (Custom quote / no Stripe ID).
      if (!tier.stripePriceId) {
        out.push({
          tier,
          group,
          status: "missing",
          expectedCents,
          stripeCents: null,
          currency: null,
          recurring: null,
          message: tier.price.toLowerCase() === "custom"
            ? "Custom quote — no Stripe price configured (expected)"
            : "No stripePriceId configured for this tier",
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
            message: error?.message || data?.error || "Failed to resolve Stripe price",
          });
          continue;
        }

        const stripeCents = typeof data.amount === "number" ? data.amount : null;
        const currency = typeof data.currency === "string" ? data.currency : null;
        const recurring = data.recurring?.interval ? `every ${data.recurring.interval}` : "one-time";

        if (expectedCents == null) {
          out.push({
            tier,
            group,
            status: "error",
            expectedCents,
            stripeCents,
            currency,
            recurring,
            message: `Could not parse displayed price "${tier.price}"`,
          });
          continue;
        }

        if (stripeCents === expectedCents) {
          out.push({
            tier,
            group,
            status: "match",
            expectedCents,
            stripeCents,
            currency,
            recurring,
            message: `Displayed ${tier.price}${tier.period} matches Stripe`,
          });
        } else {
          const diff = stripeCents != null ? (stripeCents - expectedCents) / 100 : 0;
          out.push({
            tier,
            group,
            status: "mismatch",
            expectedCents,
            stripeCents,
            currency,
            recurring,
            message: `Stripe is ${diff >= 0 ? "+" : ""}${diff.toFixed(2)} ${currency?.toUpperCase() || "USD"} vs displayed price`,
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
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
    setRows(out);
    setRunning(false);
  };

  const summary = rows
    ? {
        total: rows.length,
        match: rows.filter((r) => r.status === "match").length,
        mismatch: rows.filter((r) => r.status === "mismatch").length,
        missing: rows.filter((r) => r.status === "missing").length,
        error: rows.filter((r) => r.status === "error").length,
      }
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Pricing consistency check
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Verifies displayed CRM tier prices match the configured Stripe price IDs ({env}).
            </p>
          </div>
          <Button onClick={runCheck} disabled={running} size="sm" variant="outline" className="gap-2">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {running ? "Checking…" : "Run check"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!rows && !running && (
          <p className="text-sm text-muted-foreground">
            Click <strong>Run check</strong> to compare each tier's displayed price against its Stripe price.
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
              {summary.mismatch > 0 && <Badge variant="destructive">Mismatch: {summary.mismatch}</Badge>}
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
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={`${r.group}-${r.tier.name}`}>
                      <TableCell className="font-medium text-foreground">{r.tier.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.group}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.tier.stripePriceId || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.expectedCents != null ? `${r.tier.price}${r.tier.period}` : r.tier.price}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatCents(r.stripeCents, r.currency)}
                        {r.recurring && r.stripeCents != null && (
                          <span className="ml-1 text-muted-foreground">({r.recurring})</span>
                        )}
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
