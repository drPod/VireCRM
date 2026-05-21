import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  MoreHorizontal,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  FileText,
  Copy,
  Link as LinkIcon,
  History,
  Mail,
  Zap,
  Sparkles,
  Download,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { regenerateQuotePdf, getQuotePdfSignedUrl } from "@/functions/quote-pdf.functions";
import { sendAdminQuoteEmail } from "@/functions/admin-quote-email.functions";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { type Quote, type QuoteStatus, STATUS_STYLES } from "@/types/quotes";
import { StatCard } from "@/components/admin/StatCard";
import { QuoteBuilderDialog } from "@/components/admin/QuoteBuilderDialog";
import { QuoteHistoryDialog, TimestampCell } from "@/components/admin/QuoteHistoryDialog";
import { RecipientsView } from "@/components/admin/RecipientsView";

export function QuotesPanel() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | QuoteStatus>("all");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [historyQuote, setHistoryQuote] = useState<Quote | null>(null);
  const [view, setView] = useState<"quotes" | "recipients">("quotes");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_quotes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(`Failed to load quotes: ${error.message}`);
      setLoading(false);
      return;
    }
    setQuotes((data ?? []) as unknown as Quote[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin_quotes_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_quotes" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(
    () => (statusFilter === "all" ? quotes : quotes.filter((q) => q.status === statusFilter)),
    [quotes, statusFilter],
  );

  const stats = useMemo(() => {
    const counts = { draft: 0, sent: 0, paid: 0, cancelled: 0 } as Record<QuoteStatus, number>;
    let outstandingCents = 0;
    let paidCents = 0;
    for (const q of quotes) {
      counts[q.status] += 1;
      if (q.status === "sent") outstandingCents += q.total_cents;
      if (q.status === "paid") paidCents += q.total_cents;
    }
    return { counts, outstandingCents, paidCents };
  }, [quotes]);

  const updateStatus = async (id: string, status: QuoteStatus) => {
    const patch: {
      status: QuoteStatus;
      sent_at?: string;
      paid_at?: string;
    } = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await supabase.from("admin_quotes").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${status}`);
    load();
  };

  const deleteQuote = async (id: string) => {
    if (!confirm("Delete this quote permanently?")) return;
    const { error } = await supabase.from("admin_quotes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Quote deleted");
    load();
  };

  const copyShare = (q: Quote) => {
    const lines = [
      `${q.title} — ${q.quote_number}`,
      `For: ${q.recipient_name}${q.recipient_company ? ` (${q.recipient_company})` : ""}`,
      "",
      ...q.line_items.map(
        (li) =>
          `• ${li.description} — ${li.quantity} × ${formatMoney(li.unit_price_cents, q.currency)}`,
      ),
      "",
      `Total: ${formatMoney(q.total_cents, q.currency)}`,
      q.payment_link_url ? `Pay: ${q.payment_link_url}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(lines);
    toast.success("Quote summary copied");
  };

  const generatePaymentLink = async (q: Quote, mode: "total" | "items") => {
    const t = toast.loading(
      `Generating Stripe payment link (${mode === "items" ? "per item" : "total"})…`,
    );
    const clientToken = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined) ?? "";
    const environment = clientToken.startsWith("pk_live_") ? "live" : "sandbox";
    const { data, error } = await supabase.functions.invoke("create-quote-payment-link", {
      body: { quoteId: q.id, mode, environment },
    });
    toast.dismiss(t);
    if (error || !data?.payment_link_url) {
      toast.error(error?.message || data?.error || "Failed to generate payment link");
      return;
    }
    try {
      await navigator.clipboard.writeText(data.payment_link_url);
    } catch {
      /* clipboard may be blocked — link is already saved on the quote */
    }
    toast.success(`Payment link ready (${data.environment}) — copied to clipboard`);
    load();
  };

  const regeneratePdfFn = useServerFn(regenerateQuotePdf);
  const getSignedPdfUrlFn = useServerFn(getQuotePdfSignedUrl);
  const sendQuoteEmailFn = useServerFn(sendAdminQuoteEmail);

  const sendQuoteEmail = async (q: Quote) => {
    if (!q.recipient_email) {
      toast.error("Add a recipient email before sending");
      return;
    }
    const t = toast.loading(`Emailing proposal to ${q.recipient_email}…`);
    try {
      // Auto-generate PDF if missing so the link in the email is valid.
      if (!q.pdf_url) {
        toast.message("Generating proposal PDF…", { id: t });
        await regeneratePdfFn({ data: { quoteId: q.id } });
      }
      const res = await sendQuoteEmailFn({ data: { quoteId: q.id } });
      toast.dismiss(t);
      if (!res.success) {
        toast.error(
          res.reason === "email_suppressed"
            ? "Recipient is on the suppression list — email not sent."
            : `Email blocked: ${res.reason ?? "unknown"}`,
        );
        return;
      }
      toast.success(
        res.alreadySent
          ? `Resent proposal to ${q.recipient_email}`
          : `Proposal queued to ${q.recipient_email}`,
      );
      load();
    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "Failed to send proposal email");
    }
  };

  const regeneratePdf = async (q: Quote) => {
    const t = toast.loading("Generating proposal PDF…");
    try {
      const res = await regeneratePdfFn({ data: { quoteId: q.id } });
      toast.dismiss(t);
      toast.success("PDF regenerated");
      window.open(res.pdfUrl, "_blank");
      load();
    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "Failed to regenerate PDF");
    }
  };
  const openPdf = async (q: Quote) => {
    const t = toast.loading("Preparing PDF…");
    try {
      const res = await getSignedPdfUrlFn({ data: { quoteId: q.id } });
      toast.dismiss(t);
      window.open(res.signedUrl, "_blank");
    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "Failed to open PDF");
    }
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Drafts" value={stats.counts.draft.toString()} />
        <StatCard label="Sent (outstanding)" value={formatMoney(stats.outstandingCents)} />
        <StatCard label="Paid" value={formatMoney(stats.paidCents)} />
        <StatCard label="Total quotes" value={quotes.length.toString()} />
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="quotes" className="gap-2">
            <FileText className="h-4 w-4" /> Quotes
          </TabsTrigger>
          <TabsTrigger value="recipients" className="gap-2">
            <Mail className="h-4 w-4" /> Recipients
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Quotes
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Build, send, and track custom quotes. Status flows: draft → sent → paid.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={load} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  onClick={() => {
                    setEditing(null);
                    setBuilderOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> New quote
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading quotes…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No quotes yet. Click{" "}
                  <span className="font-medium text-foreground">New quote</span> to create one.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Draft</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((q) => (
                      <TableRow
                        key={q.id}
                        className="cursor-pointer"
                        onClick={() => setHistoryQuote(q)}
                      >
                        <TableCell className="font-mono text-xs">{q.quote_number}</TableCell>
                        <TableCell>
                          <div className="text-sm">{q.recipient_name}</div>
                          <div className="text-xs text-muted-foreground">{q.recipient_email}</div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{q.title}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(q.total_cents, q.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_STYLES[q.status]}>
                            {q.status}
                          </Badge>
                        </TableCell>
                        <TimestampCell value={q.created_at} />
                        <TimestampCell value={q.sent_at} />
                        <TimestampCell value={q.paid_at} />
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(q);
                                  setBuilderOpen(true);
                                }}
                              >
                                <FileText className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setHistoryQuote(q)}>
                                <History className="mr-2 h-4 w-4" /> View history
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyShare(q)}>
                                <Copy className="mr-2 h-4 w-4" /> Copy summary
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => regeneratePdf(q)}>
                                <Sparkles className="mr-2 h-4 w-4" /> Regenerate proposal PDF
                              </DropdownMenuItem>
                              {q.pdf_url && (
                                <DropdownMenuItem onClick={() => openPdf(q)}>
                                  <Download className="mr-2 h-4 w-4" /> Open latest PDF
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => generatePaymentLink(q, "total")}>
                                <Zap className="mr-2 h-4 w-4" /> Generate Stripe link (total)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => generatePaymentLink(q, "items")}>
                                <Zap className="mr-2 h-4 w-4" /> Generate Stripe link (per item)
                              </DropdownMenuItem>
                              {q.payment_link_url && (
                                <DropdownMenuItem
                                  onClick={() => window.open(q.payment_link_url!, "_blank")}
                                >
                                  <LinkIcon className="mr-2 h-4 w-4" /> Open payment link
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {q.status !== "paid" && q.status !== "cancelled" && (
                                <DropdownMenuItem onClick={() => sendQuoteEmail(q)}>
                                  <Mail className="mr-2 h-4 w-4" />
                                  {q.status === "sent"
                                    ? "Resend proposal email"
                                    : "Send proposal email"}
                                </DropdownMenuItem>
                              )}
                              {q.status === "draft" && (
                                <DropdownMenuItem onClick={() => updateStatus(q.id, "sent")}>
                                  <Send className="mr-2 h-4 w-4" /> Mark as sent (no email)
                                </DropdownMenuItem>
                              )}
                              {q.status === "sent" && (
                                <DropdownMenuItem onClick={() => updateStatus(q.id, "paid")}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as paid
                                </DropdownMenuItem>
                              )}
                              {q.status !== "cancelled" && q.status !== "paid" && (
                                <DropdownMenuItem onClick={() => updateStatus(q.id, "cancelled")}>
                                  <XCircle className="mr-2 h-4 w-4" /> Cancel
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteQuote(q.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipients" className="mt-4">
          <RecipientsView quotes={quotes} onOpenQuote={(q) => setHistoryQuote(q)} />
        </TabsContent>
      </Tabs>

      <QuoteBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        quote={editing}
        onSaved={() => {
          setBuilderOpen(false);
          setEditing(null);
          load();
        }}
      />

      <QuoteHistoryDialog
        quote={historyQuote}
        onOpenChange={(open) => !open && setHistoryQuote(null)}
      />
    </div>
  );
}
