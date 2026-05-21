import { formatDistanceToNow } from "date-fns";
import { Download, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusVariant } from "@/lib/submission-helpers";
import type { PlatformInvoiceRow } from "@/types/admin";

/**
 * Single row in the existing-invoices list for a submission. Renders status
 * badge, amount, environment badge, and the resend / void / refund actions
 * the admin can take on each Stripe invoice.
 */
export function SubmissionInvoiceListItem({
  inv,
  actingId,
  onAction,
}: {
  inv: PlatformInvoiceRow;
  actingId: string | null;
  onAction: (inv: PlatformInvoiceRow, action: "void" | "refund" | "resend") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-background p-2 text-sm">
      <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
      <span className="font-mono text-xs text-muted-foreground">
        {inv.number ?? inv.stripe_invoice_id}
      </span>
      <span className="tabular-nums">
        ${(inv.amount_due_cents / 100).toFixed(2)} {inv.currency.toUpperCase()}
      </span>
      {inv.amount_paid_cents > 0 ? (
        <span className="text-xs text-muted-foreground">
          paid ${(inv.amount_paid_cents / 100).toFixed(2)}
        </span>
      ) : null}
      {inv.environment === "sandbox" ? (
        <Badge variant="outline" className="text-[10px]">
          test
        </Badge>
      ) : null}
      <span className="ml-auto flex gap-2">
        {inv.hosted_invoice_url ? (
          <Button asChild size="sm" variant="outline">
            <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
              Payment link
            </a>
          </Button>
        ) : null}
        {inv.invoice_pdf ? (
          <Button asChild size="sm" variant="outline" title="Download invoice PDF">
            <a
              href={inv.invoice_pdf}
              download={`invoice-${inv.number ?? inv.stripe_invoice_id ?? inv.id}.pdf`}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="h-3 w-3" />
              PDF
            </a>
          </Button>
        ) : null}
        {inv.status !== "void" && inv.status !== "paid" && inv.status !== "refunded" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={actingId === inv.id}
            onClick={() => onAction(inv, "resend")}
            title="Resend the Stripe-hosted invoice email to the prospect"
          >
            {actingId === inv.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Resend email"
            )}
          </Button>
        ) : null}
        {inv.status !== "void" && inv.status !== "paid" && inv.status !== "refunded" ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={actingId === inv.id}
            onClick={() => onAction(inv, "void")}
          >
            {actingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Void"}
          </Button>
        ) : null}
        {inv.amount_paid_cents > 0 && inv.status !== "refunded" ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-amber-400 hover:text-amber-300"
            disabled={actingId === inv.id}
            onClick={() => onAction(inv, "refund")}
          >
            {actingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refund"}
          </Button>
        ) : null}
      </span>
      <div className="w-full text-[11px] text-muted-foreground">
        Created {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
        {inv.paid_at ? (
          <> · paid {formatDistanceToNow(new Date(inv.paid_at), { addSuffix: true })}</>
        ) : null}
        {inv.due_date && !inv.paid_at ? (
          <> · due {new Date(inv.due_date).toLocaleDateString()}</>
        ) : null}
      </div>
    </div>
  );
}
