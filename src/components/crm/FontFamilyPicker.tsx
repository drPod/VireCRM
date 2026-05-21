import { Type } from "lucide-react";
import { SUPPORTED_FONTS } from "@/lib/white-label-theme";

export function FontFamilyPicker({
  fontFamily,
  setFontFamily,
}: {
  fontFamily: string;
  setFontFamily: (next: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <Type className="h-4 w-4 text-muted-foreground" />
        <label className="text-sm font-medium text-foreground">Brand Font</label>
      </div>
      <select
        value={fontFamily}
        onChange={(e) => setFontFamily(e.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">Default (Inter)</option>
        {SUPPORTED_FONTS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      {fontFamily && (
        <div
          className="mt-3 rounded-lg bg-secondary/50 p-3 text-base text-foreground"
          style={{ fontFamily }}
        >
          The quick brown fox jumps over the lazy dog
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Applied across the CRM and emails so your brand reads consistently everywhere.
      </p>
    </div>
  );
}
