import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import {
  type Quote,
  type LineItem,
  type Differentiator,
  emptyLineItem,
  DEFAULT_DIFFERENTIATORS,
} from "@/types/quotes";

export function QuoteBuilderDialog({
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
  const [differentiators, setDifferentiators] = useState<Differentiator[]>([]);
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
        setDifferentiators(
          quote.differentiators && quote.differentiators.length > 0
            ? quote.differentiators
            : DEFAULT_DIFFERENTIATORS,
        );
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
        setDifferentiators(DEFAULT_DIFFERENTIATORS);
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
      differentiators: differentiators.filter(
        (d) => d.title.trim() || d.body.trim(),
      ) as unknown as import("@/integrations/supabase/types").Json,
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
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                maxLength={200}
              />
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
              <Input
                value={recipientCompany}
                onChange={(e) => setRecipientCompany(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Valid until</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quote title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. VireCRM White-Label Setup"
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
                    onChange={(e) =>
                      updateItem(idx, {
                        quantity: Math.max(1, parseInt(e.target.value || "1", 10)),
                      })
                    }
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
                        unit_price_cents: Math.max(
                          0,
                          Math.round(parseFloat(e.target.value || "0") * 100),
                        ),
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
            <div className="flex items-center justify-between">
              <div>
                <Label>What separates VireCRM from other CRMs</Label>
                <p className="text-xs text-muted-foreground">
                  Bullets shown on the proposal PDF. Edit, add, or remove to tailor for this
                  recipient.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDifferentiators(DEFAULT_DIFFERENTIATORS)}
                >
                  Reset to defaults
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDifferentiators((p) => [...p, { title: "", body: "" }])}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add bullet
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {differentiators.map((d, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-start rounded-md border border-border/50 bg-muted/20 p-3"
                >
                  <div className="col-span-11 space-y-2">
                    <Input
                      placeholder="Title (e.g. Built-in AI sales team)"
                      value={d.title}
                      maxLength={120}
                      onChange={(e) =>
                        setDifferentiators((p) =>
                          p.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                        )
                      }
                    />
                    <Textarea
                      rows={2}
                      placeholder="Supporting sentence shown under the title"
                      value={d.body}
                      maxLength={400}
                      onChange={(e) =>
                        setDifferentiators((p) =>
                          p.map((x, i) => (i === idx ? { ...x, body: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    onClick={() => setDifferentiators((p) => p.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {differentiators.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No bullets — section will be hidden in the PDF.
                </p>
              )}
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
