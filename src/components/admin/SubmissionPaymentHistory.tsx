import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CreditCard, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { statusVariant } from "@/lib/submission-helpers";
import type { AdminSubmissionRow, PaymentHistoryResult } from "@/types/admin";

/**
 * Per-submission Stripe payment history. Fetches `admin_submission_payment_history`
 * (Postgres RPC) when the submission row is expanded; shows linked-customer
 * badge + totals + invoice table. Extracted sibling of `ContactSubmissionsPanel`.
 */
export function SubmissionPaymentHistory({ submission }: { submission: AdminSubmissionRow }) {
  const [data, setData] = useState<PaymentHistoryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: res, error } = await supabase.rpc("admin_submission_payment_history", {
      p_submission_id: submission.id,
    });
    if (error) toast.error("Could not load payment history", { description: error.message });
    else setData(res as unknown as PaymentHistoryResult);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission.id]);

  const fmt = (c: number, cur = "usd") => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur.toUpperCase(),
      }).format((c || 0) / 100);
    } catch {
      return `$${((c || 0) / 100).toFixed(2)}`;
    }
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 mt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CreditCard className="h-4 w-4 text-primary" />
          Payment history
          {data?.stripe_customer_ids && data.stripe_customer_ids.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              linked Stripe customer
            </Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-7 gap-1">
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>

      {data && data.invoices.length > 0 && (
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Invoices</div>
            <div className="font-semibold text-foreground">{data.totals.invoices ?? 0}</div>
          </div>
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Paid</div>
            <div className="font-semibold text-emerald-400">{fmt(data.totals.paid_cents ?? 0)}</div>
          </div>
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Outstanding</div>
            <div className="font-semibold text-amber-400">
              {fmt(data.totals.outstanding_cents ?? 0)}
            </div>
          </div>
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Stripe customers</div>
            <div className="font-mono text-[10px] text-foreground truncate">
              {data.stripe_customer_ids?.[0] || "—"}
            </div>
          </div>
        </div>
      )}

      {data && data.invoices.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No prior invoices for {data.email || submission.email}. The next invoice will create a
          Stripe customer that future submissions from this email will reuse.
        </p>
      ) : data ? (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Env</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.invoices.map((iv) => (
              <TableRow key={iv.id}>
                <TableCell className="text-xs">
                  <div className="text-foreground">
                    {iv.number || iv.stripe_invoice_id || iv.id.slice(0, 8)}
                  </div>
                  {iv.description && (
                    <div className="text-muted-foreground line-clamp-1">{iv.description}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="text-foreground">{fmt(iv.amount_due_cents, iv.currency)}</div>
                  {iv.amount_paid_cents > 0 && (
                    <div className="text-emerald-400">
                      paid {fmt(iv.amount_paid_cents, iv.currency)}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(iv.status)}>{iv.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {iv.environment}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(iv.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  {iv.hosted_invoice_url ? (
                    <a
                      href={iv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
