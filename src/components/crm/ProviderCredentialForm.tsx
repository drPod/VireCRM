import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2 } from "lucide-react";
import type { ProviderConfig } from "@/types/integrations";

export interface ProviderCredentialFormProps {
  config: ProviderConfig;
  editing: boolean;
  saving: boolean;
  apiKey: string;
  fieldOne: string;
  fieldTwo: string;
  onApiKeyChange: (v: string) => void;
  onFieldOneChange: (v: string) => void;
  onFieldTwoChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  apiKeyInputRef: RefObject<HTMLInputElement | null>;
  fieldOneInputRef: RefObject<HTMLInputElement | null>;
}

/**
 * The credential editor — single text field OR two side-by-side fields.
 * Used both on first connect and when editing an existing key.
 */
export function ProviderCredentialForm({
  config,
  editing,
  saving,
  apiKey,
  fieldOne,
  fieldTwo,
  onApiKeyChange,
  onFieldOneChange,
  onFieldTwoChange,
  onSave,
  onCancel,
  apiKeyInputRef,
  fieldOneInputRef,
}: ProviderCredentialFormProps) {
  const tf = config.twoFieldCredentials;
  const isTwoField = !!tf;
  const canSubmit = isTwoField
    ? fieldOne.trim().length >= 4 && fieldTwo.trim().length >= 4
    : apiKey.trim().length >= 10;

  return (
    <div className="space-y-3">
      {isTwoField && tf ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">{tf.fieldOneLabel}</label>
            <input
              ref={fieldOneInputRef}
              type="text"
              value={fieldOne}
              onChange={(e) => onFieldOneChange(e.target.value)}
              placeholder={tf.fieldOnePlaceholder}
              className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
              autoComplete="off"
              spellCheck={false}
              maxLength={250}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">{tf.fieldTwoLabel}</label>
            <input
              type="password"
              value={fieldTwo}
              onChange={(e) => onFieldTwoChange(e.target.value)}
              placeholder={tf.fieldTwoPlaceholder}
              className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
              autoComplete="off"
              spellCheck={false}
              maxLength={250}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">{config.name} API key</label>
          <input
            ref={apiKeyInputRef}
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={config.inputHint}
            className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
            autoComplete="off"
            spellCheck={false}
            maxLength={500}
          />
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <Button variant="command" size="sm" onClick={onSave} disabled={saving || !canSubmit}>
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Checking with {config.name}…
            </>
          ) : editing ? (
            "Save new key"
          ) : (
            `Connect ${config.name}`
          )}
        </Button>
        {editing && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <KeyRound className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Your credentials are stored encrypted and only used by our servers. Your team and browser
          never see them.
        </span>
      </p>
    </div>
  );
}
