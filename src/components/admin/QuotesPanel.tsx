import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Clock,
  CircleDot,
  Zap,
} from "lucide-react";
import { Sparkles, Download } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { regenerateQuotePdf } from "@/lib/quote-pdf.functions";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

type QuoteStatus = "draft" | "sent" | "paid" | "cancelled";

interface LineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

interface Differentiator {
  title: string;
  body: string;
}

interface Quote {
  id: string;
  quote_number: string;
  recipient_name: string;
  recipient_email: string;
  recipient_company: string | null;
  title: string;
  notes: string | null;
  line_items: LineItem[];
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  status: QuoteStatus;
  payment_link_url: string | null;
  sent_at: string | null;
  paid_at: string | null;
  valid_until: string | null;
  created_at: string;
  differentiators: Differentiator[] | null;
  pdf_url: string | null;
}

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  paid: "bg-green-500/15 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
};

const formatMoney = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);

const emptyLineItem = (): LineItem => ({
  description: "",
  quantity: 1,
  unit_price_cents: 0,
});

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_quotes" },
        () => {
          load();
        },
      )
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
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
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
                  No quotes yet. Click <span className="font-medium text-foreground">New quote</span> to create one.
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
                      <TableRow key={q.id} className="cursor-pointer" onClick={() => setHistoryQuote(q)}>
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
                              {q.status === "draft" && (
                                <DropdownMenuItem onClick={() => updateStatus(q.id, "sent")}>
                                  <Send className="mr-2 h-4 w-4" /> Mark as sent
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function QuoteBuilderDialog({
  open,
  onOpenChange,
  quote,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quote: Quote | null;
  onSaved: () => void;
}) {
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientCompany, setRecipientCompany] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyLineItem()]);
  const [discountDollars, setDiscountDollars] = useState("0");
  const [paymentLinkUrl, setPaymentLinkUrl] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (quote) {
        setRecipientName(quote.recipient_name);
        setRecipientEmail(quote.recipient_email);
        setRecipientCompany(quote.recipient_company ?? "");
        setTitle(quote.title);
        setNotes(quote.notes ?? "");
        setItems(quote.line_items.length ? quote.line_items : [emptyLineItem()]);
        setDiscountDollars((quote.discount_cents / 100).toString());
        setPaymentLinkUrl(quote.payment_link_url ?? "");
        setValidUntil(quote.valid_until ?? "");
      } else {
        setRecipientName("");
        setRecipientEmail("");
        setRecipientCompany("");
        setTitle("");
        setNotes("");
        setItems([emptyLineItem()]);
        setDiscountDollars("0");
        setPaymentLinkUrl("");
        setValidUntil("");
      }
    }
  }, [open, quote]);

  const subtotalCents = items.reduce(
    (sum, li) => sum + Math.round(li.quantity * li.unit_price_cents),
    0,
  );
  const discountCents = Math.max(0, Math.round(parseFloat(discountDollars || "0") * 100));
  const totalCents = Math.max(0, subtotalCents - discountCents);

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const save = async () => {
    if (!recipientName.trim() || !recipientEmail.trim() || !title.trim()) {
      toast.error("Recipient name, email, and title are required");
      return;
    }
    if (items.length === 0 || items.every((i) => !i.description.trim())) {
      toast.error("Add at least one line item");
      return;
    }
    setSaving(true);
    const cleanItems = items.filter((i) => i.description.trim());
    const payload = {
      recipient_name: recipientName.trim(),
      recipient_email: recipientEmail.trim(),
      recipient_company: recipientCompany.trim() || null,
      title: title.trim(),
      notes: notes.trim() || null,
      line_items: cleanItems as unknown as import("@/integrations/supabase/types").Json,
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      total_cents: totalCents,
      payment_link_url: paymentLinkUrl.trim() || null,
      valid_until: validUntil || null,
    };
    let error;
    if (quote) {
      ({ error } = await supabase.from("admin_quotes").update(payload).eq("id", quote.id));
    } else {
      const user = (await supabase.auth.getUser()).data.user;
      ({ error } = await supabase
        .from("admin_quotes")
        .insert({ ...payload, created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(quote ? "Quote updated" : "Quote created");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? `Edit ${quote.quote_number}` : "New quote"}</DialogTitle>
          <DialogDescription>
            Build a custom quote. It saves as a draft until you mark it sent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Recipient name *</Label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Recipient email *</Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={recipientCompany} onChange={(e) => setRecipientCompany(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Valid until</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quote title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Genesis White-Label Setup"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setItems((p) => [...p, emptyLineItem()])}
              >
                <Plus className="mr-1 h-3 w-3" /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                  <Input
                    className="col-span-6"
                    placeholder="Description"
                    value={it.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    maxLength={300}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value || "1", 10)) })}
                  />
                  <Input
                    className="col-span-3"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Unit price"
                    value={(it.unit_price_cents / 100).toString()}
                    onChange={(e) =>
                      updateItem(idx, {
                        unit_price_cents: Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100)),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Discount ($)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={discountDollars}
                onChange={(e) => setDiscountDollars(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment link (optional)</Label>
              <Input
                placeholder="https://buy.stripe.com/…"
                value={paymentLinkUrl}
                onChange={(e) => setPaymentLinkUrl(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="Terms, scope, follow-up details…"
            />
          </div>

          <div className="rounded-md border bg-muted/30 p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(subtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>−{formatMoney(discountCents)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold pt-1 border-t">
              <span>Total</span>
              <span>{formatMoney(totalCents)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {quote ? "Save changes" : "Create quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimestampCell({ value }: { value: string | null }) {
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

function QuoteHistoryDialog({
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
                      <span>{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
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

function RecipientsView({
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
