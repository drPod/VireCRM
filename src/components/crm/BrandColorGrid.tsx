import { useRef } from "react";
import { Download, FileUp, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandColorRow } from "@/components/crm/BrandColorRow";

export type BrandPaletteState = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  sidebarColor: string;
  buttonColor: string;
};

export type BrandPaletteSetters = {
  setPrimaryColor: (next: string) => void;
  setSecondaryColor: (next: string) => void;
  setAccentColor: (next: string) => void;
  setSidebarColor: (next: string) => void;
  setButtonColor: (next: string) => void;
};

export function BrandColorGrid({
  palette,
  setters,
  onExport,
  onImport,
}: {
  palette: BrandPaletteState;
  setters: BrandPaletteSetters;
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <div>
            <label className="text-sm font-medium text-foreground">Brand Palette</label>
            <p className="text-xs text-muted-foreground">
              Primary is required. The other colors are optional — leave them blank to derive them
              from primary.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              // Reset so re-importing the same file fires onChange.
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            title="Load a previously exported theme JSON"
          >
            <FileUp className="h-3.5 w-3.5" />
            Import
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onExport}
            title="Download the current theme as JSON to share or back up"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      <BrandColorRow
        label="Primary"
        description="Buttons, links, focus rings, active sidebar item."
        value={palette.primaryColor}
        onChange={setters.setPrimaryColor}
      />
      <BrandColorRow
        label="Secondary"
        description="Soft surfaces, badges, secondary buttons."
        value={palette.secondaryColor}
        onChange={setters.setSecondaryColor}
        optional
      />
      <BrandColorRow
        label="Accent"
        description="Hover states, subtle highlights."
        value={palette.accentColor}
        onChange={setters.setAccentColor}
        optional
      />
      <BrandColorRow
        label="Sidebar"
        description="Background of the left navigation rail."
        value={palette.sidebarColor}
        onChange={setters.setSidebarColor}
        optional
      />
      <BrandColorRow
        label="Call-to-action button"
        description="Distinct CTA color (e.g. green for sign-ups)."
        value={palette.buttonColor}
        onChange={setters.setButtonColor}
        optional
      />
    </div>
  );
}
