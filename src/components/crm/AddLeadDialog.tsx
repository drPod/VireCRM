import { useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Sparkles, X, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAutoOutreach } from "@/hooks/useAutoOutreach";
import { useAutoOutreachPreference } from "@/hooks/useAutoOutreachPreference";
import { toast } from "sonner";

const statusOptions = ["new", "contacted", "qualified", "negotiation", "won", "lost"] as const;

interface CustomField {
  id: string;
  label: string;
  value: string;
}

interface AddLeadDialogProps {
  onLeadAdded?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

function makeFieldId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `cf-${Math.random().toString(36).slice(2, 11)}`;
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
    contract_end_date: "" as string,
    current_supplier: "",
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [showAdditional, setShowAdditional] = useState(false);
  const formId = useId();
  const fid = (name: string) => `${formId}-${name}`;

  const update = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const addCustomField = () =>
    setCustomFields((prev) => [...prev, { id: makeFieldId(), label: "", value: "" }]);
  const updateCustomField = (id: string, key: "label" | "value", v: string) =>
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: v } : f)));
  const removeCustomField = (id: string) =>
    setCustomFields((prev) => prev.filter((f) => f.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Lead name is required");
      return;
    }
    if (!user?.id) {
      toast.error("Please wait for your account to finish loading, then try again");
      return;
    }
    if (!organization?.id) {
      toast.error("No organization found");
      return;
    }

    const customLines = customFields
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label || f.value)
      .map((f) => `${f.label || "Field"}: ${f.value}`)
      .join("\n");
    const composedNotes = [form.notes.trim(), customLines].filter(Boolean).join("\n\n") || null;

    setLoading(true);
    try {
      const { error, data: inserted } = await supabase
        .from("leads")
        .insert({
          organization_id: organization.id,
          created_by: user.id,
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
        })
        .select("id, name, email, company");
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
  const labelClass = "mb-1 block text-xs font-medium text-foreground";

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
              <label htmlFor={fid("name")} className={labelClass}>
                Name <span aria-hidden="true">*</span>
              </label>
              <input
                id={fid("name")}
                name="name"
                autoComplete="name"
                required
                aria-required="true"
                className={inputClass}
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={fid("company")} className={labelClass}>
                Company
              </label>
              <input
                id={fid("company")}
                name="company"
                autoComplete="organization"
                className={inputClass}
                placeholder="Acme Corp"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={fid("email")} className={labelClass}>
                Email
              </label>
              <input
                id={fid("email")}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className={inputClass}
                placeholder="jane@acme.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={fid("phone")} className={labelClass}>
                Phone
              </label>
              <input
                id={fid("phone")}
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                className={inputClass}
                placeholder="+1 555-0123"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={fid("status")} className={labelClass}>
                Status
              </label>
              <select
                id={fid("status")}
                name="status"
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
              <label htmlFor={fid("score")} className={labelClass}>
                Score (0–100)
              </label>
              <input
                id={fid("score")}
                name="score"
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                className={inputClass}
                value={form.score}
                onChange={(e) => update("score", Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label htmlFor={fid("next_action")} className={labelClass}>
              Next Action
            </label>
            <input
              id={fid("next_action")}
              name="next_action"
              className={inputClass}
              placeholder="Send intro email"
              value={form.next_action}
              onChange={(e) => update("next_action", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={fid("notes")} className={labelClass}>
              Notes / description
            </label>
            <textarea
              id={fid("notes")}
              name="notes"
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
              aria-expanded={showAdditional}
              aria-controls={fid("additional-panel")}
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
              <div
                id={fid("additional-panel")}
                className="space-y-3 border-t border-border/60 px-3 py-3"
              >
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Energy / utilities (optional)
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={fid("contract_end_date")} className={labelClass}>
                        Contract end date
                      </label>
                      <input
                        id={fid("contract_end_date")}
                        name="contract_end_date"
                        type="date"
                        className={inputClass}
                        value={form.contract_end_date}
                        onChange={(e) => update("contract_end_date", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor={fid("current_supplier")} className={labelClass}>
                        Current supplier
                      </label>
                      <input
                        id={fid("current_supplier")}
                        name="current_supplier"
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
                      {customFields.map((f) => (
                        <div key={f.id} className="flex items-center gap-2">
                          <label htmlFor={`${fid("cf-label")}-${f.id}`} className="sr-only">
                            Custom field name
                          </label>
                          <input
                            id={`${fid("cf-label")}-${f.id}`}
                            name={`custom_field_label_${f.id}`}
                            className={`${inputClass} sm:max-w-[40%]`}
                            placeholder="Field name"
                            value={f.label}
                            onChange={(e) => updateCustomField(f.id, "label", e.target.value)}
                          />
                          <label htmlFor={`${fid("cf-value")}-${f.id}`} className="sr-only">
                            Custom field value
                          </label>
                          <input
                            id={`${fid("cf-value")}-${f.id}`}
                            name={`custom_field_value_${f.id}`}
                            className={inputClass}
                            placeholder="Value"
                            value={f.value}
                            onChange={(e) => updateCustomField(f.id, "value", e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeCustomField(f.id)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                            aria-label={`Remove field${f.label ? ` ${f.label}` : ""}`}
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
