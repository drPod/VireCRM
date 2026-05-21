import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { AssigneeMultiSelect, type AssigneeOption } from "@/components/crm/AssigneeMultiSelect";
import type { AudienceFilter } from "@/lib/campaigns/audience-filter";

const STATUS_OPTIONS = ["new", "contacted", "qualified", "proposal", "negotiating", "won", "lost"];

interface Props {
  organizationId: string;
  value: AudienceFilter;
  onChange: (next: AudienceFilter) => void;
}

export function AudienceFilterBuilder({ organizationId, value, onChange }: Props) {
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: profiles }, { data: tagRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("organization_id", organizationId),
        supabase
          .from("leads")
          .select("tags")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .limit(500),
      ]);
      if (cancelled) return;
      setAssignees(
        (profiles ?? []).map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name ?? "Unknown",
        })),
      );
      const tagSet = new Set<string>();
      for (const row of tagRows ?? []) {
        for (const t of (row.tags ?? []) as string[]) {
          if (t) tagSet.add(t);
        }
      }
      setAllTags(Array.from(tagSet).sort());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const toggleStatus = (s: string) => {
    const cur = value.statuses ?? [];
    onChange({
      ...value,
      statuses: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    });
  };

  const toggleTag = (t: string) => {
    const cur = value.tags ?? [];
    onChange({
      ...value,
      tags: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
    });
  };

  const addCustomTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    const cur = value.tags ?? [];
    if (!cur.includes(t)) onChange({ ...value, tags: [...cur, t] });
    setTagInput("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Lead status</Label>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => {
            const active = value.statuses?.includes(s) ?? false;
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Assigned to</Label>
        <AssigneeMultiSelect
          options={assignees}
          selected={value.assignees ?? []}
          onChange={(next) => onChange({ ...value, assignees: next.length ? next : undefined })}
          placeholder="Any assignee"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="audience-search">Search (name, company, email)</Label>
        <Input
          id="audience-search"
          value={value.search ?? ""}
          onChange={(e) => onChange({ ...value, search: e.target.value || undefined })}
          placeholder="acme"
        />
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        {value.tags && value.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {value.tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button
                  type="button"
                  onClick={() => toggleTag(t)}
                  className="hover:text-destructive"
                  aria-label={`Remove tag ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add tag…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomTag();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustomTag}>
            Add
          </Button>
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {allTags.slice(0, 20).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="has-email" className="text-sm">
              Require email address
            </Label>
            <p className="text-xs text-muted-foreground">Skip leads without an email on file.</p>
          </div>
          <Switch
            id="has-email"
            checked={value.has_email ?? false}
            onCheckedChange={(v) => onChange({ ...value, has_email: v || undefined })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="exclude-closed" className="text-sm">
              Exclude closed leads
            </Label>
            <p className="text-xs text-muted-foreground">
              Skip leads with status <code>won</code> or <code>lost</code>.
            </p>
          </div>
          <Switch
            id="exclude-closed"
            checked={value.exclude_closed ?? false}
            onCheckedChange={(v) => onChange({ ...value, exclude_closed: v || undefined })}
          />
        </div>
      </div>
    </div>
  );
}
