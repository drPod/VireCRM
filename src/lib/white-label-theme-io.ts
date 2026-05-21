/**
 * Serialise / deserialise the WhiteLabelSettings form to a portable JSON file
 * so tenants can export, back up, or move their brand between environments.
 */
import { isValidHexColor } from "@/lib/white-label-hex";

export type BrandThemeSnapshot = {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  sidebarColor: string;
  buttonColor: string;
  logoUrl: string;
  faviconUrl: string;
  fontFamily: string;
  emailSignature: string;
};

export type BrandThemePayload = {
  schema: "genesis.brand-theme";
  version: 1;
  exportedAt: string;
  brandName: string | null;
  palette: {
    primary: string | null;
    secondary: string | null;
    accent: string | null;
    sidebar: string | null;
    button: string | null;
  };
  assets: {
    logoUrl: string | null;
    faviconUrl: string | null;
  };
  typography: { fontFamily: string | null };
  email: { signature: string | null };
};

export function buildThemePayload(snapshot: BrandThemeSnapshot): BrandThemePayload {
  return {
    schema: "genesis.brand-theme",
    version: 1,
    exportedAt: new Date().toISOString(),
    brandName: snapshot.brandName || null,
    palette: {
      primary: snapshot.primaryColor || null,
      secondary: snapshot.secondaryColor || null,
      accent: snapshot.accentColor || null,
      sidebar: snapshot.sidebarColor || null,
      button: snapshot.buttonColor || null,
    },
    assets: {
      logoUrl: snapshot.logoUrl || null,
      faviconUrl: snapshot.faviconUrl || null,
    },
    typography: { fontFamily: snapshot.fontFamily || null },
    email: { signature: snapshot.emailSignature || null },
  };
}

export function slugifyBrandName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function downloadThemeFile(payload: BrandThemePayload, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Patch produced by importing a theme JSON. Only keys that appeared in the
 * file are present, so callers can `Object.assign(state, patch)` without
 * clobbering fields the file omitted.
 */
export type BrandThemePatch = Partial<BrandThemeSnapshot>;

/**
 * Parse a previously exported theme JSON into a patch the form can merge.
 *
 * Palette colors keep "" (means "inherit from primary") but any non-empty
 * value MUST be a valid hex — otherwise a corrupt file could poison the form.
 * Primary specifically falls back to the default blue when the file explicitly
 * cleared it, because primary is required.
 */
export function parseThemeFile(raw: string): BrandThemePatch {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("File is not a valid theme JSON");
  }
  const theme = parsed as Record<string, unknown>;
  const palette = (theme.palette as Record<string, unknown>) || {};
  const assets = (theme.assets as Record<string, unknown>) || {};
  const typography = (theme.typography as Record<string, unknown>) || {};
  const email = (theme.email as Record<string, unknown>) || {};

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const hex = (v: unknown): string | null => {
    if (v === null || v === undefined) return "";
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    if (trimmed === "") return "";
    return isValidHexColor(trimmed) ? trimmed : null;
  };

  const paletteFields: Array<[string, unknown]> = [
    ["primary", palette.primary],
    ["secondary", palette.secondary],
    ["accent", palette.accent],
    ["sidebar", palette.sidebar],
    ["button", palette.button],
  ];
  for (const [key, rawValue] of paletteFields) {
    if (rawValue !== undefined && hex(rawValue) === null) {
      throw new Error(`Theme file has an invalid hex value for "${key}"`);
    }
  }

  const patch: BrandThemePatch = {};

  if (typeof theme.brandName === "string") patch.brandName = theme.brandName;
  if (palette.primary !== undefined) {
    const next = hex(palette.primary);
    patch.primaryColor = next && next !== "" ? next : "#3b82f6";
  }
  if (palette.secondary !== undefined) patch.secondaryColor = hex(palette.secondary) ?? "";
  if (palette.accent !== undefined) patch.accentColor = hex(palette.accent) ?? "";
  if (palette.sidebar !== undefined) patch.sidebarColor = hex(palette.sidebar) ?? "";
  if (palette.button !== undefined) patch.buttonColor = hex(palette.button) ?? "";
  if (assets.logoUrl !== undefined) patch.logoUrl = str(assets.logoUrl);
  if (assets.faviconUrl !== undefined) patch.faviconUrl = str(assets.faviconUrl);
  if (typography.fontFamily !== undefined) patch.fontFamily = str(typography.fontFamily);
  if (email.signature !== undefined) patch.emailSignature = str(email.signature);

  return patch;
}
