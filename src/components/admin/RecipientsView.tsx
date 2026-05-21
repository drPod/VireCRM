import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { formatMoney } from "@/lib/money";
import { type Quote, STATUS_STYLES } from "@/types/quotes";

export function RecipientsView({
  quotes,
  onOpenQuote,
}: {
  quotes: Quote[];
  onOpenQuote: (q: Quote) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        email: string;
        name: string;
        company: string | null;
        quotes: Quote[];
        totalCents: number;
        paidCents: number;
        outstandingCents: number;
        lastActivity: string;
      }
    >();
    for (const q of quotes) {
      const key = q.recipient_email.toLowerCase();
      const existing = map.get(key);
      const lastActivity = q.paid_at ?? q.sent_at ?? q.created_at;
      if (existing) {
        existing.quotes.push(q);
        existing.totalCents += q.total_cents;
        if (q.status === "paid") existing.paidCents += q.total_cents;
        if (q.status === "sent") existing.outstandingCents += q.total_cents;
        if (lastActivity > existing.lastActivity) existing.lastActivity = lastActivity;
      } else {
        map.set(key, {
          email: q.recipient_email,
          name: q.recipient_name,
          company: q.recipient_company,
          quotes: [q],
          totalCents: q.total_cents,
          paidCents: q.status === "paid" ? q.total_cents : 0,
          outstandingCents: q.status === "sent" ? q.total_cents : 0,
          lastActivity,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.lastActivity > a.lastActivity ? 1 : -1));
  }, [quotes]);

  const [openEmail, setOpenEmail] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Recipients
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          All recipients you've quoted, with totals and history. Click a row to expand.
        </p>
      </CardHeader>
      <CardContent>
        {grouped.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No recipients yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead className="text-right">Total quoted</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((r) => (
                <>
                  <TableRow
                    key={r.email}
                    className="cursor-pointer"
                    onClick={() => setOpenEmail(openEmail === r.email ? null : r.email)}
                  >
                    <TableCell>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.email}
                        {r.company ? ` • ${r.company}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{r.quotes.length}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.totalCents)}</TableCell>
                    <TableCell className="text-right text-green-400">
                      {formatMoney(r.paidCents)}
                    </TableCell>
                    <TableCell className="text-right text-blue-400">
                      {formatMoney(r.outstandingCents)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.lastActivity), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                  {openEmail === r.email && (
                    <TableRow key={`${r.email}-detail`}>
                      <TableCell colSpan={6} className="bg-muted/20 p-0">
                        <div className="p-4 space-y-2">
                          {r.quotes
                            .slice()
                            .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
                            .map((q) => (
                              <button
                                key={q.id}
                                onClick={() => onOpenQuote(q)}
                                className="flex w-full items-center justify-between rounded-md border bg-background p-3 text-left text-sm hover:bg-accent transition"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-xs">{q.quote_number}</span>
                                  <span className="truncate max-w-xs">{q.title}</span>
                                  <Badge variant="outline" className={STATUS_STYLES[q.status]}>
                                    {q.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>{format(new Date(q.created_at), "MMM d, yyyy")}</span>
                                  <span className="font-medium text-foreground">
                                    {formatMoney(q.total_cents, q.currency)}
                                  </span>
                                </div>
                              </button>
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
