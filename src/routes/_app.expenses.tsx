import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Plus, Receipt, Trash2, AlertTriangle, Megaphone, Wrench, UserCircle, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, formatCompactMoney, dollarsToCents } from "@/lib/money";
import { toast } from "sonner";

interface Expense {
  id: string;
  category: string;
  vendor: string | null;
  description: string | null;
  amount_cents: number;
  currency: string;
  incurred_at: string;
  created_at: string;
}

const CATEGORIES = [
  { value: "ads", label: "Ads", icon: Megaphone, color: "text-orange-400" },
  { value: "tools", label: "Tools / Software", icon: Wrench, color: "text-blue-400" },
  { value: "salary", label: "Salary / Contractor", icon: UserCircle, color: "text-purple-400" },
  { value: "other", label: "Other", icon: Box, color: "text-muted-foreground" },
];

function ExpensesErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Couldn't load expenses</p>
            <p className="text-xs text-muted-foreground mt-1">{error?.message}</p>
          </div>
        </div>
        <Button
          variant="command"
          size="sm"
          className="mt-4"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/expenses")({
  component: ExpensesPage,
  errorComponent: ExpensesErrorComponent,
  head: () => ({
    meta: [
      { title: "Expenses — Genesis" },
      {
        name: "description",
        content: "Track ads, tools, payroll, and other business costs to see your true profit.",
      },
    ],
  }),
});

function ExpensesPage() {
  const { organization, role, user } = useAuth();
  const canEdit = role?.role === "owner" || role?.role === "manager";
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("organization_id", organization.id)
      .order("incurred_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setItems((data || []) as Expense[]);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const totalAll = items.reduce((s, e) => s + e.amount_cents, 0);
  const byCategory = CATEGORIES.map((c) => ({
    ...c,
    total: items.filter((e) => e.category === c.value).reduce((s, e) => s + e.amount_cents, 0),
  }));

  const remove = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense removed");
    load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track every cost so your Revenue dashboard shows real profit.
          </p>
        </div>
        {canEdit && (
          <Button variant="command" size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Log Expense
          </Button>
        )}
      </div>

      {/* Category summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {byCategory.map((c) => (
          <div key={c.value} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              <span className="text-sm font-medium text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground mt-2">{formatCompactMoney(c.total)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent expenses</h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatMoney(totalAll)} total
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-foreground">No expenses logged yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click <span className="font-medium">Log Expense</span> to add your first one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Vendor</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  {canEdit && <th className="px-4 py-2.5 font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((e) => {
                  const cat = CATEGORIES.find((c) => c.value === e.category);
                  return (
                    <tr key={e.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(e.incurred_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">
                          {cat?.label || e.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground">{e.vendor || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {e.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                        {formatMoney(e.amount_cents, e.currency)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExpenseDialog
        open={open}
        onOpenChange={setOpen}
        organizationId={organization?.id || ""}
        userId={user?.id || ""}
        onSaved={load}
      />
    </div>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
  organizationId,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  organizationId: string;
  userId: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    category: "ads",
    vendor: "",
    description: "",
    amount: "",
    incurred_at: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const cents = dollarsToCents(form.amount);
    if (cents <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (!organizationId) return;
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      organization_id: organizationId,
      created_by: userId || null,
      category: form.category,
      vendor: form.vendor.trim() || null,
      description: form.description.trim() || null,
      amount_cents: cents,
      incurred_at: form.incurred_at,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense logged");
    onSaved();
    onOpenChange(false);
    setForm({
      category: "ads",
      vendor: "",
      description: "",
      amount: "",
      incurred_at: new Date().toISOString().slice(0, 10),
    });
  };

  const inputClass =
    "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Expense</DialogTitle>
          <DialogDescription>Track a business cost so it shows up in your P&L.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Category</label>
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Date</label>
              <input
                type="date"
                className={inputClass}
                value={form.incurred_at}
                onChange={(e) => setForm({ ...form, incurred_at: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Vendor</label>
            <input
              className={inputClass}
              placeholder="Google Ads, Notion, etc."
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Amount (USD) *</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className={inputClass}
              placeholder="250.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Description</label>
            <input
              className={inputClass}
              placeholder="Optional note"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="command" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save expense"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
