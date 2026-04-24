/**
 * White-label theming engine.
 *
 * Owners pick a small palette (primary, secondary, accent, sidebar, button)
 * and we map each color to the shadcn/Tailwind design tokens that drive that
 * surface — so the entire CRM, reseller storefront, and emails re-skin in
 * one go without touching component code.
 *
 * Every applier is idempotent and returns a cleanup that restores the
 * previous values, so callers can safely re-run on prop change inside React
 * effects (and tests can roll back between runs).
 */

export type BrandPalette = {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  sidebar?: string | null;
  button?: string | null;
};

/* -------------------------------------------------------------------------- */
/*                            Token group definitions                          */
/* -------------------------------------------------------------------------- */

/**
 * Tokens driven by the primary brand color. These power buttons, focus
 * rings, links, default chart series, and a re-usable --wl-primary
 * variable for component-level styling.
 */
const PRIMARY_TOKENS = ["--primary", "--ring", "--chart-1", "--wl-primary"] as const;
const PRIMARY_FOREGROUND_TOKENS = ["--primary-foreground"] as const;

/** Light surfaces, badges, "secondary" button variants. */
const SECONDARY_TOKENS = ["--secondary", "--muted", "--input", "--wl-secondary"] as const;
const SECONDARY_FOREGROUND_TOKENS = ["--secondary-foreground", "--muted-foreground"] as const;

/** Hover states, soft tints, accent badges. */
const ACCENT_TOKENS = ["--accent", "--wl-accent"] as const;
const ACCENT_FOREGROUND_TOKENS = ["--accent-foreground"] as const;

/** Sidebar surface + active item pill. */
const SIDEBAR_TOKENS = [
  "--sidebar",
  "--sidebar-primary",
  "--sidebar-ring",
  "--sidebar-accent",
  "--wl-sidebar",
] as const;
const SIDEBAR_FOREGROUND_TOKENS = [
  "--sidebar-primary-foreground",
  "--sidebar-accent-foreground",
  "--sidebar-foreground",
] as const;

/**
 * Distinct CTA color (defaults to primary if unset). Components opt in via
 * the `command` button variant or by reading --wl-button directly.
 */
const BUTTON_TOKENS = ["--wl-button"] as const;
const BUTTON_FOREGROUND_TOKENS = ["--wl-button-foreground"] as const;

/* -------------------------------------------------------------------------- */
/*                              Color utilities                                */
/* -------------------------------------------------------------------------- */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").trim();
  if (m.length !== 3 && m.length !== 6) return null;
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const toLin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/** Pick #ffffff or near-black depending on background luminance. */
function readableForeground(color: string): string | null {
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  return relativeLuminance(rgb) > 0.55 ? "#0b0b0f" : "#ffffff";
}

/* -------------------------------------------------------------------------- */
/*                              Token application                              */
/* -------------------------------------------------------------------------- */

/**
 * Save+set a list of CSS variables on `document.documentElement`. Returns the
 * cleanup so the caller can restore the previous values. Centralises the
 * "remember + restore" dance every applier needs.
 */
function setTokens(
  tokens: readonly string[],
  value: string,
  store: Map<string, string>,
) {
  const root = document.documentElement;
  for (const token of tokens) {
    if (!store.has(token)) store.set(token, root.style.getPropertyValue(token));
    root.style.setProperty(token, value);
  }
}

function restoreTokens(store: Map<string, string>) {
  const root = document.documentElement;
  for (const [token, value] of store) {
    if (value) root.style.setProperty(token, value);
    else root.style.removeProperty(token);
  }
}

/**
 * Apply the full brand palette to all themed CSS variables.
 *
 * Backwards compatible with the older single-color signature:
 * `applyWhiteLabelColor("#7c3aed")` still works and is treated as the
 * primary color.
 */
export function applyWhiteLabelColor(
  paletteOrPrimary: BrandPalette | string | null | undefined,
): () => void {
  if (typeof document === "undefined") return () => {};

  const palette: BrandPalette =
    typeof paletteOrPrimary === "string"
      ? { primary: paletteOrPrimary }
      : paletteOrPrimary || {};

  // Nothing to apply → no-op cleanup
  if (!palette.primary && !palette.secondary && !palette.accent && !palette.sidebar && !palette.button) {
    return () => {};
  }

  const store = new Map<string, string>();

  // Primary
  if (palette.primary) {
    setTokens(PRIMARY_TOKENS, palette.primary, store);
    const fg = readableForeground(palette.primary);
    if (fg) setTokens(PRIMARY_FOREGROUND_TOKENS, fg, store);
  }

  // Secondary
  if (palette.secondary) {
    setTokens(SECONDARY_TOKENS, palette.secondary, store);
    const fg = readableForeground(palette.secondary);
    if (fg) setTokens(SECONDARY_FOREGROUND_TOKENS, fg, store);
  }

  // Accent
  if (palette.accent) {
    setTokens(ACCENT_TOKENS, palette.accent, store);
    const fg = readableForeground(palette.accent);
    if (fg) setTokens(ACCENT_FOREGROUND_TOKENS, fg, store);
  }

  // Sidebar
  if (palette.sidebar) {
    setTokens(SIDEBAR_TOKENS, palette.sidebar, store);
    const fg = readableForeground(palette.sidebar);
    if (fg) setTokens(SIDEBAR_FOREGROUND_TOKENS, fg, store);
  }

  // Button — falls back to primary, but always exposes --wl-button for
  // components that opt into the brand CTA color explicitly.
  const buttonColor = palette.button || palette.primary;
  if (buttonColor) {
    setTokens(BUTTON_TOKENS, buttonColor, store);
    const fg = readableForeground(buttonColor);
    if (fg) setTokens(BUTTON_FOREGROUND_TOKENS, fg, store);
  }

  return () => restoreTokens(store);
}

/* -------------------------------------------------------------------------- */
/*                                  Favicon                                    */
/* -------------------------------------------------------------------------- */

/**
 * Swap the browser favicon to the org's branded icon. Updates (or creates)
 * the <link rel="icon"> tag and returns a cleanup that restores the original.
 */
export function applyFavicon(faviconUrl: string | null | undefined): () => void {
  if (typeof document === "undefined" || !faviconUrl) return () => {};
  const head = document.head;
  const existing = head.querySelector<HTMLLinkElement>("link[rel~='icon']");
  const previousHref = existing?.href ?? null;
  const previousType = existing?.type ?? null;

  let link = existing;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    head.appendChild(link);
  }
  const lower = faviconUrl.toLowerCase();
  if (lower.endsWith(".svg")) link.type = "image/svg+xml";
  else if (lower.endsWith(".png")) link.type = "image/png";
  else if (lower.endsWith(".ico")) link.type = "image/x-icon";
  link.href = faviconUrl;

  return () => {
    if (!link) return;
    if (previousHref) {
      link.href = previousHref;
      if (previousType) link.type = previousType;
    } else {
      link.parentElement?.removeChild(link);
    }
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Fonts                                     */
/* -------------------------------------------------------------------------- */

const FONT_STACKS: Record<string, string> = {
  Inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  Poppins: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  Manrope: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  "Plus Jakarta Sans":
    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  "DM Sans": "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  "Space Grotesk":
    "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  Outfit: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  "IBM Plex Sans":
    "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export const SUPPORTED_FONTS = Object.keys(FONT_STACKS);

export function applyBrandFont(fontFamily: string | null | undefined): () => void {
  if (typeof document === "undefined" || !fontFamily) return () => {};
  const stack = FONT_STACKS[fontFamily];
  if (!stack) return () => {};

  const head = document.head;
  const id = `wl-font-${fontFamily.replace(/\s+/g, "-").toLowerCase()}`;
  let link = head.querySelector<HTMLLinkElement>(`link[data-wl-font='${id}']`);
  let createdLink = false;
  if (!link) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.wlFont = id;
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      fontFamily,
    )}:wght@400;500;600;700;800&display=swap`;
    head.appendChild(link);
    createdLink = true;
  }

  const root = document.documentElement;
  const previousVar = root.style.getPropertyValue("--wl-font");
  const previousInline = root.style.fontFamily;
  root.style.setProperty("--wl-font", stack);
  root.style.fontFamily = stack;

  return () => {
    if (previousVar) root.style.setProperty("--wl-font", previousVar);
    else root.style.removeProperty("--wl-font");
    root.style.fontFamily = previousInline;
    if (createdLink && link?.parentElement) link.parentElement.removeChild(link);
  };
}
