import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Sparkles, X, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAutoOutreach } from "@/hooks/useAutoOutreach";
import { useAutoOutreachPreference } from "@/hooks/useAutoOutreachPreference";
import { toast } from "sonner";

const statusOptions = ["new", "contacted", "qualified", "negotiation", "won", "lost"] as const;

interface AddLeadDialogProps {
  onLeadAdded?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function AddLeadDialog({
  onLeadAdded,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
}: AddLeadDialogProps) {
  const { organization, user } = useAuth();
  const { triggerOutreach } = useAutoOutreach();
  const { enabled: outreachEnabled, setEnabled: setOutreachEnabled } = useAutoOutreachPreference();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    controlledOnOpenChange?.(v);
  };
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "new" as string,
    score: 50,
    next_action: "",
    notes: "",
    contract_end_date: "" as string, // YYYY-MM-DD
    current_supplier: "",
  });
  // Custom user-defined fields appended to the lead notes/description.
  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>([]);
  // Additional details (industry-specific + custom) hidden by default — not every CRM user sells energy.
  const [showAdditional, setShowAdditional] = useState(false);

  const update = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const addCustomField = () =>
    setCustomFields((prev) => [...prev, { label: "", value: "" }]);
  const updateCustomField = (idx: number, key: "label" | "value", v: string) =>
    setCustomFields((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: v } : f)));
  const removeCustomField = (idx: number) =>
    setCustomFields((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Lead name is required");
      return;
    }
    if (!organization?.id) {
      toast.error("No organization found");
      return;
    }

    // Compose notes with any custom fields appended as "Label: value" lines.
    const customLines = customFields
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label || f.value)
      .map((f) => `${f.label || "Field"}: ${f.value}`)
      .join("\n");
    const composedNotes = [form.notes.trim(), customLines].filter(Boolean).join("\n\n") || null;

    setLoading(true);
    try {
      const { error, data: inserted } = await supabase.from("leads").insert({
        organization_id: organization.id,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        status: form.status,
        score: form.score,
        next_action: form.next_action.trim() || null,
        notes: composedNotes,
        contract_end_date: form.contract_end_date || null,
        current_supplier: form.current_supplier.trim() || null,
      }).select("id, name, email, company");
      if (error) throw error;
      toast.success(`Lead "${form.name}" added!`);
      setForm({
        name: "",
        email: "",
        phone: "",
        company: "",
        status: "new",
        score: 50,
        next_action: "",
        notes: "",
        contract_end_date: "",
        current_supplier: "",
      });
      setCustomFields([]);
      setOpen(false);
      onLeadAdded?.();

      // Trigger auto-outreach in background — only if the user has it enabled.
      if (outreachEnabled && inserted && inserted.length > 0) {
        triggerOutreach(inserted);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add lead");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="command" size="sm">
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Name *</label>
              <input
                className={inputClass}
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Company</label>
              <input
                className={inputClass}
                placeholder="Acme Corp"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
              <input
                type="email"
                className={inputClass}
                placeholder="jane@acme.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Phone</label>
              <input
                className={inputClass}
                placeholder="+1 555-0123"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Status</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Score (0–100)</label>
              <input
                type="number"
                min={0}
                max={100}
                className={inputClass}
                value={form.score}
                onChange={(e) => update("score", Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Next Action</label>
            <input
              className={inputClass}
              placeholder="Send intro email"
              value={form.next_action}
              onChange={(e) => update("next_action", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Notes / description</label>
            <textarea
              className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
              rows={2}
              placeholder="Any notes about this lead..."
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>

          {/* Collapsible additional details — keeps the form clean for non-energy users. */}
          <div className="rounded-lg border border-border bg-secondary/20">
            <button
              type="button"
              onClick={() => setShowAdditional((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/40 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-1.5">
                {showAdditional ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Add additional lead details
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">
                Industry-specific & custom fields
              </span>
            </button>
            {showAdditional && (
              <div className="space-y-3 border-t border-border/60 px-3 py-3">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Energy / utilities (optional)
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Contract end date
                      </label>
                      <input
                        type="date"
                        className={inputClass}
                        value={form.contract_end_date}
                        onChange={(e) => update("contract_end_date", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Current supplier
                      </label>
                      <input
                        className={inputClass}
                        placeholder="e.g. British Gas, EDF, Octopus"
                        value={form.current_supplier}
                        onChange={(e) => update("current_supplier", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Custom fields
                    </p>
                    <button
                      type="button"
                      onClick={addCustomField}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      + Add field
                    </button>
                  </div>
                  {customFields.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Add any field your business needs (e.g. policy number, fleet size, deal size).
                      Custom fields are appended to the description.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {customFields.map((f, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            className={`${inputClass} sm:max-w-[40%]`}
                            placeholder="Field name"
                            value={f.label}
                            onChange={(e) => updateCustomField(idx, "label", e.target.value)}
                          />
                          <input
                            className={inputClass}
                            placeholder="Value"
                            value={f.value}
                            onChange={(e) => updateCustomField(idx, "value", e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeCustomField(idx)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                            aria-label="Remove field"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
            <label
              htmlFor="auto-outreach-add"
              className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI auto-outreach
              <span className="font-normal text-muted-foreground">
                — send a personalized email after adding
              </span>
            </label>
            <Switch
              id="auto-outreach-add"
              checked={outreachEnabled}
              onCheckedChange={setOutreachEnabled}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="command" size="sm" disabled={loading}>
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Add Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
