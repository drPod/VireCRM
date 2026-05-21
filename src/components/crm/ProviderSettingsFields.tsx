import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FIELD_RULES } from "@/lib/connectors/validation";
import type { Provider, ProviderConfigField } from "@/types/integrations";
import type { SettingsDraft, TouchedSettings } from "./provider-card.types";

export interface ProviderSettingsFieldsProps {
  providerId: Provider;
  fields: ProviderConfigField[];
  draft: SettingsDraft;
  errors: Record<string, string | null>;
  touched: TouchedSettings;
  dirty: boolean;
  valid: boolean;
  saving: boolean;
  onChange: (key: string, value: string) => void;
  onBlur: (key: string) => void;
  onSave: () => void;
}

/**
 * Non-secret editable settings panel (e.g. SendGrid's defaultFromAddress).
 * Format errors stay quiet until each field has been blurred once, then
 * re-validate live as the user types.
 */
export function ProviderSettingsFields({
  providerId,
  fields,
  draft,
  errors,
  touched,
  dirty,
  valid,
  saving,
  onChange,
  onBlur,
  onSave,
}: ProviderSettingsFieldsProps) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3">
      {fields.map((f) => {
        const ruleKey = `${providerId}.${f.key}`;
        const rule = FIELD_RULES[ruleKey];
        const rawErr = errors[f.key];
        // Hide the inline error until the user blurs the field
        // — once touched, it re-validates live as they type.
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
              onChange={(e) => onChange(f.key, e.target.value)}
              onBlur={() => onBlur(f.key)}
              placeholder={f.placeholder}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? `${providerId}-${f.key}-err` : undefined}
              className={`h-8 w-full rounded-md border bg-input px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring ${
                err ? "border-destructive/60" : "border-input"
              }`}
              spellCheck={false}
              disabled={saving}
            />
            {err ? (
              <p id={`${providerId}-${f.key}-err`} className="text-[10px] text-destructive">
                {err}
              </p>
            ) : f.helper ? (
              <p className="text-[10px] text-muted-foreground">{f.helper}</p>
            ) : null}
          </div>
        );
      })}
      {dirty && (
        <Button
          variant="command"
          size="sm"
          onClick={onSave}
          disabled={saving || !valid}
          title={!valid ? "Fix the highlighted fields before saving." : undefined}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save settings
        </Button>
      )}
    </div>
  );
}
