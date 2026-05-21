import { useMemo } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadAssigneesField } from "./LeadAssigneesField";
import { LeadDealValuePanel } from "./LeadDealValuePanel";
import { ShareLeadPanel } from "./ShareLeadPanel";
import {
  STATUS_OPTIONS,
  type LeadFormState,
  type OrgMember,
} from "./LeadDetailDrawer.types";
import type { Lead } from "./LeadCard";

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

export interface DealValidation {
  valid: boolean;
  error?: string;
  cents?: number;
}

/**
 * Validates the free-text deal amount. Accepts plain numbers, "$1,234",
 * "1234.50" etc. Used by both the save handler and the Mark-as-Won button
 * to gate submission.
 */
export function useDealValidation(rawValue: string): DealValidation {
  return useMemo<DealValidation>(() => {
    const raw = rawValue.trim();
    if (!raw) return { valid: false, error: "Enter a positive deal value" };
    const cleaned = raw.replace(/[^\d.]/g, "");
    const n = cleaned ? Number(cleaned) : NaN;
    if (!Number.isFinite(n) || n <= 0) {
      return { valid: false, error: "Deal value must be greater than 0" };
    }
    return { valid: true, cents: Math.round(n * 100) };
  }, [rawValue]);
}

interface LeadDetailsFormProps {
  lead: Lead;
  form: LeadFormState;
  update: (field: keyof LeadFormState, value: string | number) => void;
  loadingNotes: boolean;
  members: OrgMember[];
  assigneeIds: string[];
  setAssigneeIds: (ids: string[]) => void;
  canAssign: boolean;
  dealValidation: DealValidation;
  saving: boolean;
  deleting: boolean;
  markingWon: boolean;
  confirmDelete: boolean;
  onCancelDelete: () => void;
  onSave: () => void;
  onMarkWon: () => void;
  onDelete: () => void;
}

/**
 * Details tab body for `LeadDetailDrawer`. Owns the field layout only —
 * state lives in `useLeadForm`, save/delete/won orchestration lives in the
 * drawer itself. Deal-value + assignees panels are extracted to siblings
 * to keep this file focused on the contact/status fields.
 */
export function LeadDetailsForm({
  lead,
  form,
  update,
  loadingNotes,
  members,
  assigneeIds,
  setAssigneeIds,
  canAssign,
  dealValidation,
  saving,
  deleting,
  markingWon,
  confirmDelete,
  onCancelDelete,
  onSave,
  onMarkWon,
  onDelete,
}: LeadDetailsFormProps) {
  return (
    <div className="space-y-4 pt-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Name *</label>
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Lead name"
        />
      </div>

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
          <label className="mb-1 block text-xs font-medium text-foreground">
            Score (0–100)
          </label>
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

      <LeadAssigneesField
        members={members}
        assigneeIds={assigneeIds}
        setAssigneeIds={setAssigneeIds}
        canAssign={canAssign}
      />

      <ShareLeadPanel
        leadId={lead.id}
        createdBy={lead.createdBy ?? null}
        assignedTo={lead.assignedTo ?? null}
      />

      <LeadDealValuePanel
        form={form}
        update={update}
        dealValidation={dealValidation}
        markingWon={markingWon}
        onMarkWon={onMarkWon}
      />

      <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Energy details
        </p>
        <div className="grid gap-3 grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Annual kWh</label>
            <input
              inputMode="numeric"
              className={inputClass}
              value={form.annual_kwh}
              onChange={(e) => update("annual_kwh", e.target.value)}
              placeholder="e.g. 120000"
            />
          </div>
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
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">
              Current supplier
            </label>
            <input
              className={inputClass}
              value={form.current_supplier}
              onChange={(e) => update("current_supplier", e.target.value)}
              placeholder="e.g. British Gas, EDF, Octopus"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Next Action</label>
        <input
          className={inputClass}
          value={form.next_action}
          onChange={(e) => update("next_action", e.target.value)}
          placeholder="e.g. Send follow-up email"
        />
      </div>

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

      <div className="flex items-center justify-between pt-4 border-t border-border gap-2 flex-wrap">
        <Button
          variant={confirmDelete ? "destructive" : "outline"}
          size="sm"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          {confirmDelete ? "Confirm Delete" : "Delete"}
        </Button>
        <Button
          variant="command"
          size="sm"
          onClick={onSave}
          disabled={saving || !dealValidation.valid}
          title={dealValidation.valid ? "Save changes" : "Enter a positive deal value to save"}
        >
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
          <button className="underline hover:no-underline" onClick={onCancelDelete}>
            Cancel
          </button>
        </p>
      )}
    </div>
  );
}
