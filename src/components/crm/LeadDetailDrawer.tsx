import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Lead } from "./LeadCard";

const STATUS_OPTIONS: Lead["status"][] = ["new", "contacted", "qualified", "negotiation", "won", "lost"];

interface LeadDetailDrawerProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function LeadDetailDrawer({ lead, open, onOpenChange, onUpdated }: LeadDetailDrawerProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "new" as string,
    score: 50,
    next_action: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Load lead data into form when lead changes
  useEffect(() => {
    if (!lead) return;
    setConfirmDelete(false);

    // Load basic fields from the Lead object
    setForm({
      name: lead.name,
      email: lead.email || "",
      phone: lead.phone || "",
      company: lead.company || "",
      status: lead.status,
      score: lead.score,
      next_action: lead.nextAction || "",
      notes: "",
    });

    // Fetch notes from DB (not in Lead type)
    setLoadingNotes(true);
    supabase
      .from("leads")
      .select("notes")
      .eq("id", lead.id)
      .single()
      .then(({ data }) => {
        if (data?.notes) setForm((prev) => ({ ...prev, notes: data.notes ?? "" }));
        setLoadingNotes(false);
      });
  }, [lead]);

  const update = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!lead || !form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("leads")
      .update({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        status: form.status,
        score: form.score,
        next_action: form.next_action.trim() || null,
        notes: form.notes.trim() || null,
      })
      .eq("id", lead.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to update lead");
    } else {
      toast.success("Lead updated");
      onUpdated();
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete lead");
    } else {
      toast.success("Lead deleted");
      onUpdated();
      onOpenChange(false);
    }
  };

  const inputClass =
    "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Lead Details</SheetTitle>
          <SheetDescription>Edit lead information and save changes.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pt-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Name *</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Lead name"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          {/* Phone & Company */}
          <div className="grid gap-4 grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Phone</label>
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+1 555-0123"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Company</label>
              <input
                className={inputClass}
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
          </div>

          {/* Status & Score */}
          <div className="grid gap-4 grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Status</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
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

          {/* Next Action */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Next Action</label>
            <input
              className={inputClass}
              value={form.next_action}
              onChange={(e) => update("next_action", e.target.value)}
              placeholder="e.g. Send follow-up email"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Notes</label>
            {loadingNotes ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : (
              <textarea
                className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={4}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Notes about this lead…"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {confirmDelete ? "Confirm Delete" : "Delete"}
            </Button>
            <Button variant="command" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Changes
            </Button>
          </div>

          {confirmDelete && (
            <p className="text-xs text-destructive text-center">
              Click again to permanently delete this lead.{" "}
              <button
                className="underline hover:no-underline"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
