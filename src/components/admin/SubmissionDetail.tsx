import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { buildInvoiceMailto } from "@/lib/submission-helpers";
import type { AdminSubmissionRow } from "@/types/admin";

import { SubmissionInvoicePanel } from "./SubmissionInvoicePanel";
import { SubmissionPaymentHistory } from "./SubmissionPaymentHistory";

/**
 * The expanded-row detail for a single submission: contact info, message body,
 * AI classification, metadata blob, status action buttons, and the Stripe
 * payment-history + invoice panels. Rendered inline as a second `<TableRow>`
 * directly below the summary row when expanded.
 */
export function SubmissionDetail({
  submission,
  savingId,
  onSetStatus,
}: {
  submission: AdminSubmissionRow;
  savingId: string | null;
  onSetStatus: (id: string, status: string) => void;
}) {
  const s = submission;
  return (
    <TableRow className="bg-muted/20">
      <TableCell colSpan={7} className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Contact</div>
            <div className="text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span>{" "}
                <a href={`mailto:${s.email}`} className="text-primary hover:underline">
                  {s.email}
                </a>
              </div>
              {s.phone ? (
                <div>
                  <span className="text-muted-foreground">Phone:</span>{" "}
                  <a href={`tel:${s.phone}`} className="text-primary hover:underline">
                    {s.phone}
                  </a>
                </div>
              ) : null}
              {s.company ? (
                <div>
                  <span className="text-muted-foreground">Company:</span> {s.company}
                </div>
              ) : null}
              {s.origin ? (
                <div>
                  <span className="text-muted-foreground">Origin:</span>{" "}
                  <span className="font-mono text-xs">{s.origin}</span>
                </div>
              ) : null}
            </div>
            <div className="text-xs font-semibold uppercase text-muted-foreground pt-2">
              Message
            </div>
            <div className="whitespace-pre-wrap rounded border border-border bg-background p-3 text-sm">
              {s.message}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              AI Classification
            </div>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Topic:</span> {s.topic ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Sentiment:</span> {s.sentiment ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Priority:</span>{" "}
                {s.priority_suggestion ?? "—"}
              </div>
              {s.intent_summary ? (
                <div className="pt-1">
                  <div className="text-muted-foreground">Intent:</div>
                  <div className="rounded border border-border bg-background p-2 text-xs">
                    {s.intent_summary}
                  </div>
                </div>
              ) : null}
            </div>
            {s.metadata && Object.keys(s.metadata).length > 0 ? (
              <>
                <div className="text-xs font-semibold uppercase text-muted-foreground pt-2">
                  Metadata
                </div>
                <pre className="overflow-x-auto rounded border border-border bg-background p-2 text-[11px] leading-relaxed">
                  {JSON.stringify(s.metadata, null, 2)}
                </pre>
              </>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-3">
              <Button asChild size="sm" variant="outline">
                <a href={`mailto:${s.email}`}>Reply</a>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <a href={buildInvoiceMailto(s)}>Email Invoice (manual)</a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={savingId === s.id || s.status === "replied"}
                onClick={() => onSetStatus(s.id, "replied")}
              >
                Mark Replied
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={savingId === s.id || s.status === "archived"}
                onClick={() => onSetStatus(s.id, "archived")}
              >
                Archive
              </Button>
            </div>
            {s.replied_at ? (
              <div className="text-xs text-muted-foreground pt-1">
                Replied{" "}
                {formatDistanceToNow(new Date(s.replied_at), {
                  addSuffix: true,
                })}
              </div>
            ) : null}
            <SubmissionPaymentHistory submission={s} />
            <SubmissionInvoicePanel submission={s} />
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
