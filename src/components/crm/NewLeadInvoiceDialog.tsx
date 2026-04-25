import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { getStripeEnvironment } from "@/lib/stripe";

interface LineItemDraft {
  description: string;
  amount: string;
  quantity: string;
}

interface LeadOption {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
}

interface NewLeadInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  /** Pre-select a lead and lock the picker. */
  lockedLeadId?: string;
}

export function NewLeadInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
  lockedLeadId,
}: NewLeadInvoiceDialogProps) {
  const { organization } = useAuth();
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadId, setLeadId] = useState<string>(lockedLeadId ?? "");
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<LineItemDraft[]>([
    { description: "", amount: "", quantity: "1" },
  ]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [interval, setInterval] = useState<"month" | "year">("month");

  useEffect(() => {
    if (!open || !organization?.id) return;
    setLeadId(lockedLeadId ?? "");
    setDescription("");
    setItems([{ description: "", amount: "", quantity: "1" }]);
    setIsRecurring(false);
    setInterval("month");

    if (lockedLeadId) return;
    setLoadingLeads(true);
    supabase
      .from("leads")
      .select("id, name, email, company")
      .eq("organization_id", organization.id)
      .order("updated_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setLeads((data || []) as LeadOption[]);
        setLoadingLeads(false);
      });
  }, [open, organization?.id, lockedLeadId]);

  const updateItem = (idx: number, patch: Partial<LineItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const submit = async () => {
    if (!leadId) {
      toast.error("Pick a lead to invoice");
      return;
    }
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

    if (error || (data as { error?: string } | null)?.error) {
      toast.error(
        (data as { error?: string } | null)?.error ||
          error?.message ||
          "Failed to send invoice",
      );
      return;
    }
    toast.success(isRecurring ? "Recurring invoice started" : "Invoice sent to lead");
    onOpenChange(false);
    onCreated?.();
  };

  const total = items.reduce((sum, it) => {
    const amt = Number(it.amount) || 0;
    const qty = Number(it.quantity) || 1;
    return sum + amt * qty;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription>
            Send a custom Stripe invoice to a lead. They'll receive a hosted pay page
            by email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!lockedLeadId && (
            <div>
              <Label className="text-xs">Lead</Label>
              <Select value={leadId} onValueChange={setLeadId} disabled={loadingLeads}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingLeads ? "Loading…" : "Select a lead"} />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id} disabled={!l.email}>
                      {l.name}
                      {l.company ? ` · ${l.company}` : ""}
                      {!l.email ? " (no email)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">${total.toFixed(2)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="command" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRecurring ? "Start recurring billing" : "Send invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
