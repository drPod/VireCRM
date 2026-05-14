import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { dollarsToCents, centsToDollarsInput } from "@/lib/money";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSaved: () => void;
}

interface RuleRow {
  id?: string;
  user_id: string | null; // null = org default
  rule_type: "percent" | "flat";
  percent: number; // 0..1
  flat_cents: number;
  is_active: boolean;
}

interface MemberOption {
  user_id: string;
  full_name: string | null;
}

export function CommissionRulesDialog({ open, onOpenChange, organizationId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [defaultRule, setDefaultRule] = useState<RuleRow>({
    user_id: null,
    rule_type: "percent",
    percent: 0.1,
    flat_cents: 0,
    is_active: true,
  });
  const [overrides, setOverrides] = useState<RuleRow[]>([]);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoading(true);
    Promise.all([
      supabase.from("commission_rules").select("*").eq("organization_id", organizationId),
      supabase.from("profiles").select("user_id, full_name").eq("organization_id", organizationId),
    ]).then(([rulesRes, profilesRes]) => {
      const all = (rulesRes.data || []) as RuleRow[];
      const def = all.find((r) => r.user_id === null);
      if (def) setDefaultRule(def);
      setOverrides(all.filter((r) => r.user_id !== null));
      setMembers((profilesRes.data || []) as MemberOption[]);
      setLoading(false);
    });
  }, [open, organizationId]);

  const addOverride = () => {
    setOverrides((rows) => [
      ...rows,
      {
        user_id: members[0]?.user_id || null,
        rule_type: "percent",
        percent: 0.1,
        flat_cents: 0,
        is_active: true,
      },
    ]);
  };

  const removeOverride = async (idx: number) => {
    const row = overrides[idx];
    if (row.id) {
      await supabase.from("commission_rules").delete().eq("id", row.id);
    }
    setOverrides((rows) => rows.filter((_, i) => i !== idx));
  };

  const updateOverride = (idx: number, patch: Partial<RuleRow>) => {
    setOverrides((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const save = async () => {
    setSaving(true);
    // Upsert default rule
    const { error: defErr } = await supabase.from("commission_rules").upsert(
      {
        ...defaultRule,
        organization_id: organizationId,
        user_id: null,
      },
      { onConflict: "organization_id,user_id" },
    );
    if (defErr) {
      toast.error(defErr.message);
      setSaving(false);
      return;
    }

    // Upsert overrides
    for (const row of overrides) {
      if (!row.user_id) continue;
      const { error } = await supabase.from("commission_rules").upsert(
        {
          ...row,
          organization_id: organizationId,
        },
        { onConflict: "organization_id,user_id" },
      );
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    }

    toast.success("Commission rules saved");
    setSaving(false);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Commission Rules</DialogTitle>
          <DialogDescription>
            Set how reps earn commission when they close a deal. Per-rep rules override the org
            default.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 mt-2">
            {/* Org default */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Organization default</h3>
                <p className="text-xs text-muted-foreground">
                  Applied to every rep unless they have an override below.
                </p>
              </div>
              <RuleEditor
                row={defaultRule}
                onChange={(p) => setDefaultRule({ ...defaultRule, ...p })}
              />
            </div>

            {/* Per-rep overrides */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Per-rep overrides</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addOverride}
                  disabled={members.length === 0}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              </div>
              {overrides.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No overrides — every rep uses the default rule.
                </p>
              ) : (
                overrides.map((row, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 flex-1 rounded-lg border border-input bg-input px-3 text-sm"
                        value={row.user_id || ""}
                        onChange={(e) => updateOverride(idx, { user_id: e.target.value })}
                      >
                        <option value="">Select rep…</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.full_name || m.user_id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                      <Button size="icon" variant="ghost" onClick={() => removeOverride(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <RuleEditor row={row} onChange={(p) => updateOverride(idx, p)} />
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="command" onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save rules
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RuleEditor({
  row,
  onChange,
}: {
  row: RuleRow;
  onChange: (patch: Partial<RuleRow>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Rule type</label>
        <select
          className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm"
          value={row.rule_type}
          onChange={(e) => onChange({ rule_type: e.target.value as "percent" | "flat" })}
        >
          <option value="percent">% of deal value</option>
          <option value="flat">Flat fee per closed deal</option>
        </select>
      </div>
      {row.rule_type === "percent" ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            Percent (e.g. 10)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm"
            value={Math.round(row.percent * 1000) / 10}
            onChange={(e) =>
              onChange({ percent: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })
            }
          />
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            Flat amount (USD)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm"
            value={centsToDollarsInput(row.flat_cents)}
            onChange={(e) => onChange({ flat_cents: dollarsToCents(e.target.value) })}
          />
        </div>
      )}
    </div>
  );
}
