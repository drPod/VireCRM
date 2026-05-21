import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConnectorMeta } from "@/lib/connectors/catalog";
import { validateDraft, FIELD_RULES } from "@/lib/connectors/validation";

interface ConnectorConfigEditorProps {
  meta: ConnectorMeta;
  draft: Record<string, string>;
  onDraftChange: (draft: Record<string, string>) => void;
  saving: boolean;
  onSave: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConnectorConfigEditor({
  meta,
  draft,
  onDraftChange,
  saving,
  onSave,
  onCancel,
}: ConnectorConfigEditorProps) {
  // Tracks which fields the user has interacted with so on-blur validation
  // doesn't shout at them while they're still typing the first character.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const fields = meta.configFields ?? [];
  const { errors: fieldErrors, valid: draftValid } = validateDraft(meta.id, fields, draft);

  return (
    <div className="space-y-3 mb-3 p-3 rounded-md bg-secondary/30 border border-border">
      {fields.map((f) => {
        const ruleKey = `${meta.id}.${f.key}`;
        const rule = FIELD_RULES[ruleKey];
        const rawErr = fieldErrors[f.key];
        // Only surface the inline error after the user has blurred the
        // field at least once — keeps the UI quiet while they type the
        // first character, but updates instantly on subsequent edits.
        const err = touched[f.key] ? rawErr : null;
        return (
          <div key={f.key} className="space-y-1">
            <label className="block text-[11px] font-medium text-foreground">
              {f.label}
              {rule?.required && (
                <span className="text-destructive ml-0.5" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            <input
              value={draft[f.key] ?? ""}
              onChange={(e) => onDraftChange({ ...draft, [f.key]: e.target.value })}
              onBlur={() => setTouched((prev) => (prev[f.key] ? prev : { ...prev, [f.key]: true }))}
              placeholder={f.placeholder}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? `${meta.id}-${f.key}-err` : undefined}
              className={`h-8 w-full rounded-md border bg-input px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring ${
                err ? "border-destructive/60" : "border-input"
              }`}
              spellCheck={false}
            />
            {err ? (
              <p id={`${meta.id}-${f.key}-err`} className="text-[10px] text-destructive">
                {err}
              </p>
            ) : f.helper ? (
              <p className="text-[10px] text-muted-foreground">{f.helper}</p>
            ) : null}
          </div>
        );
      })}
      <div className="flex gap-2">
        <Button
          variant="command"
          size="sm"
          onClick={onSave}
          disabled={saving || !draftValid}
          title={!draftValid ? "Fix the highlighted fields before saving." : undefined}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
