import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { getStripeEnvironment } from "@/lib/stripe";

interface ClientInvoice {
  id: string;
  number: string | null;
  description: string | null;
  amount_due_cents: number;
  amount_paid_cents: number;
  currency: string;
  status: string;
  is_recurring: boolean;
  interval: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface LineItemDraft {
  description: string;
  amount: string;
  quantity: string;
}

interface LeadInvoicesPanelProps {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  organizationId: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  open: "secondary",
  draft: "outline",
  void: "destructive",
  uncollectible: "destructive",
  active: "default",
  past_due: "destructive",
};

function fmtMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function LeadInvoicesPanel({
  leadId,
  leadName,
  leadEmail,
  organizationId,
}: LeadInvoicesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [accountReady, setAccountReady] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [items, setItems] = useState<LineItemDraft[]>([
    { description: "", amount: "", quantity: "1" },
  ]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ data: invs }, { data: acc }] = await Promise.all([
      supabase
        .from("client_invoices")
        .select(
          "id, number, description, amount_due_cents, amount_paid_cents, currency, status, is_recurring, interval, hosted_invoice_url, invoice_pdf, due_date, sent_at, paid_at, created_at",
        )
        .eq("lead_id", leadId)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_stripe_accounts")
        .select("charges_enabled, details_submitted")
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);
    setInvoices((invs || []) as ClientInvoice[]);
    setAccountReady(Boolean(acc?.charges_enabled));
    setLoading(false);
  }, [leadId, organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateItem = (idx: number, patch: Partial<LineItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const submit = async () => {
    const cleaned = items
      .map((it) => ({
        description: it.description.trim(),
        amount_cents: Math.round(Number(it.amount) * 100),
        quantity: Math.max(1, Number(it.quantity) || 1),
      }))
      .filter((it) => it.description && it.amount_cents > 0);

    if (cleaned.length === 0) {
      toast.error("Add at least one valid line item");
      return;
    }
    if (!leadEmail) {
      toast.error("This lead has no email — add one before invoicing");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-lead-invoice", {
      body: {
        leadId,
        description: description || null,
        lineItems: cleaned,
        isRecurring,
        interval: isRecurring ? interval : undefined,
        send: true,
        environment: getStripeEnvironment(),
      },
    });
    setSubmitting(false);

    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to send invoice");
      return;
    }
    toast.success(isRecurring ? "Recurring invoice started" : "Invoice sent");
    setShowForm(false);
    setDescription("");
    setItems([{ description: "", amount: "", quantity: "1" }]);
    setIsRecurring(false);
    void refresh();
  };

  const voidInvoice = async (id: string) => {
    if (!confirm("Void this invoice? The lead will be notified the charge is canceled.")) return;
    const { error } = await supabase.functions.invoke("void-lead-invoice", {
      body: { invoiceId: id, environment: getStripeEnvironment() },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invoice voided");
    void refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accountReady === false) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 text-sm font-semibold">Connect Stripe to send invoices</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Set up your Stripe account in Settings → Payments to start charging this lead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {!showForm ? (
        <Button size="sm" variant="command" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          New invoice for {leadName}
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">New invoice</h4>
            <Button size="icon" variant="ghost" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this invoice for?"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Line items</Label>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-6"
                  placeholder="Description"
                  value={it.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                />
                <Input
                  className="col-span-3"
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={it.amount}
                  onChange={(e) => updateItem(idx, { amount: e.target.value })}
                />
                <Input
                  className="col-span-2"
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="col-span-1"
                  onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setItems((p) => [...p, { description: "", amount: "", quantity: "1" }])
              }
            >
              <Plus className="h-3 w-3" />
              Add item
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            <Label className="text-xs">Recurring subscription</Label>
            {isRecurring && (
              <Select value={interval} onValueChange={(v: "month" | "year") => setInterval(v)}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <Button variant="command" className="w-full" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRecurring ? "Start recurring billing" : "Send invoice"}
          </Button>
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No invoices sent yet to this lead.
        </p>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div key={inv.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {fmtMoney(inv.amount_due_cents, inv.currency)}
                    </span>
                    <Badge
                      variant={STATUS_VARIANT[inv.status] || "outline"}
                      className="text-[10px]"
                    >
                      {inv.status}
                    </Badge>
                    {inv.is_recurring && (
                      <Badge variant="outline" className="text-[10px]">
                        {inv.interval || "recurring"}
                      </Badge>
                    )}
                  </div>
                  {inv.description && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{inv.description}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {inv.number ? `#${inv.number} · ` : ""}
                    {new Date(inv.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {inv.hosted_invoice_url && (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="inline h-3 w-3" /> View
                    </a>
                  )}
                  {["open", "draft", "active", "past_due"].includes(inv.status) && (
                    <button
                      onClick={() => voidInvoice(inv.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Void
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
