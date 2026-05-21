import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, History, Clock, CircleDot } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { formatMoney } from "@/lib/money";
import { type Quote, type QuoteStatus, STATUS_STYLES } from "@/types/quotes";

export function TimestampCell({ value }: { value: string | null }) {
  if (!value) return <TableCell className="text-xs text-muted-foreground">—</TableCell>;
  const d = new Date(value);
  return (
    <TableCell className="text-xs">
      <div>{format(d, "MMM d, yyyy")}</div>
      <div className="text-muted-foreground">{format(d, "h:mm a")}</div>
    </TableCell>
  );
}

interface QuoteEvent {
  id: string;
  quote_id: string;
  event_type: string;
  from_status: QuoteStatus | null;
  to_status: QuoteStatus | null;
  actor_user_id: string | null;
  note: string | null;
  created_at: string;
}

export function QuoteHistoryDialog({
  quote,
  onOpenChange,
}: {
  quote: Quote | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [events, setEvents] = useState<QuoteEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!quote) return;
    setLoading(true);
    supabase
      .from("admin_quote_events")
      .select("*")
      .eq("quote_id", quote.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setEvents((data ?? []) as unknown as QuoteEvent[]);
        setLoading(false);
      });
  }, [quote]);

  if (!quote) return null;

  const milestones: Array<{ label: string; ts: string | null; status: QuoteStatus }> = [
    { label: "Drafted", ts: quote.created_at, status: "draft" },
    { label: "Sent", ts: quote.sent_at, status: "sent" },
    { label: "Paid", ts: quote.paid_at, status: "paid" },
  ];

  return (
    <Dialog open={!!quote} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> {quote.quote_number} — History
          </DialogTitle>
          <DialogDescription>
            {quote.title} • {quote.recipient_name} ({quote.recipient_email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status milestones
            </div>
            <div className="grid grid-cols-3 gap-3">
              {milestones.map((m) => (
                <div
                  key={m.label}
                  className={`rounded-md border p-3 ${
                    m.ts ? STATUS_STYLES[m.status] : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <div className="text-xs uppercase tracking-wide opacity-80">{m.label}</div>
                  {m.ts ? (
                    <>
                      <div className="mt-1 text-sm font-medium">
                        {format(new Date(m.ts), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs opacity-80">{format(new Date(m.ts), "h:mm a")}</div>
                    </>
                  ) : (
                    <div className="mt-1 text-sm">Not yet</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Activity timeline
            </div>
            {loading ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading events…
              </div>
            ) : events.length === 0 ? (
              <div className="text-sm text-muted-foreground">No events recorded.</div>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-6">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full border bg-background">
                      <CircleDot className="h-3 w-3 text-primary" />
                    </span>
                    <div className="text-sm font-medium capitalize">
                      {e.event_type === "created"
                        ? "Quote created"
                        : `Status changed: ${e.from_status ?? "—"} → ${e.to_status ?? "—"}`}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(e.created_at), "MMM d, yyyy 'at' h:mm a")}
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {e.note && <div className="mt-1 text-xs">{e.note}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Line items
            </div>
            <div className="rounded-md border">
              {quote.line_items.map((li, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0"
                >
                  <div>
                    {li.description}
                    <span className="ml-2 text-xs text-muted-foreground">× {li.quantity}</span>
                  </div>
                  <div className="font-medium">
                    {formatMoney(li.unit_price_cents * li.quantity, quote.currency)}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between bg-muted/30 px-3 py-2 text-sm font-semibold">
                <span>Total</span>
                <span>{formatMoney(quote.total_cents, quote.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
