import { AlertCircle } from "lucide-react";
import { isValidHexColor } from "@/lib/white-label-hex";

/**
 * Single color-picker row used inside the brand palette card. Optional rows
 * show a "Clear" button so the value can be reset to "use default" (empty
 * string) and then derived from primary by the theming engine.
 *
 * Shows an inline error when the typed value isn't a valid hex color so the
 * user can self-correct before saving. The native color picker only ever
 * emits valid hex, so picking from it implicitly clears the error.
 */
export function BrandColorRow({
  label,
  description,
  value,
  onChange,
  optional,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (next: string) => void;
  optional?: boolean;
}) {
  const trimmed = value.trim();
  const isEmpty = trimmed === "";
  const isValid = isEmpty ? optional === true : isValidHexColor(trimmed);
  const showError = !isValid;
  // Only feed a real color into native swatches when valid — otherwise fall
  // back to a neutral grey so we never throw a CSS parse warning.
  const swatch = isValid && !isEmpty ? trimmed : "#cccccc";

  const errorId = `color-error-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <p className="text-xs font-semibold text-foreground">
            {label}
            {optional && (
              <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">Optional</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        {optional && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-input"
        />
        <input
          type="text"
          value={value}
          placeholder={optional ? "Inherits from primary" : "#7c3aed"}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          className={`h-9 flex-1 rounded-md border bg-input px-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 ${
            showError ? "border-destructive focus:ring-destructive" : "border-input focus:ring-ring"
          }`}
        />
        <div
          className="h-9 w-16 rounded-md border border-border"
          style={{ backgroundColor: swatch }}
          aria-hidden
        />
      </div>
      {showError && (
        <p id={errorId} className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {isEmpty ? "Primary color is required." : "Use a 3- or 6-digit hex like #7c3aed."}
        </p>
      )}
    </div>
  );
}
