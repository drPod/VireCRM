/**
 * Apply a white-label primary color across all the design tokens that
 * carry the brand identity in the CRM. We derive a small palette from a
 * single hex/css color so owners only have to pick one value.
 */

const TOKENS = [
  "--primary",
  "--ring",
  "--sidebar-primary",
  "--sidebar-ring",
  "--chart-1",
  "--wl-primary",
] as const;

const SOFT_TOKENS = [
  "--sidebar-accent-foreground",
  "--accent-foreground",
] as const;

const FOREGROUND_TOKENS = ["--primary-foreground", "--sidebar-primary-foreground"] as const;

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

/**
 * Apply the brand color to all themed CSS variables.
 * Returns a cleanup function to restore previous values.
 */
export function applyWhiteLabelColor(color: string | null | undefined): () => void {
  if (typeof document === "undefined" || !color) return () => {};
  const root = document.documentElement;
  const previous = new Map<string, string>();

  // Save then set primary tokens to the brand color
  for (const token of TOKENS) {
    previous.set(token, root.style.getPropertyValue(token));
    root.style.setProperty(token, color);
  }

  // Pick a readable foreground (white or near-black) for buttons/sidebar pill
  const rgb = hexToRgb(color);
  if (rgb) {
    const lum = relativeLuminance(rgb);
    const fg = lum > 0.55 ? "#0b0b0f" : "#ffffff";
    for (const token of FOREGROUND_TOKENS) {
      previous.set(token, root.style.getPropertyValue(token));
      root.style.setProperty(token, fg);
    }
  }

  // A softer tint for hover/foreground accents — same hue, lighter
  for (const token of SOFT_TOKENS) {
    previous.set(token, root.style.getPropertyValue(token));
    root.style.setProperty(token, color);
  }

  return () => {
    for (const [token, value] of previous) {
      if (value) root.style.setProperty(token, value);
      else root.style.removeProperty(token);
    }
  };
}

/**
 * Swap the browser favicon to the org's branded icon. Updates (or creates)
 * the <link rel="icon"> tag and returns a cleanup that restores the original.
 */
export function applyFavicon(faviconUrl: string | null | undefined): () => void {
  if (typeof document === "undefined" || !faviconUrl) return () => {};
  const head = document.head;
  // Find or create the icon link
  const existing = head.querySelector<HTMLLinkElement>("link[rel~='icon']");
  const previousHref = existing?.href ?? null;
  const previousType = existing?.type ?? null;

  let link = existing;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    head.appendChild(link);
  }
  // Naive content-type sniff for the most common cases
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

/** Map of curated Google fonts → their CSS family stacks. */
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

/**
 * Inject the Google Font stylesheet for the chosen font and apply it to the
 * page via the --wl-font CSS variable + html font-family.
 */
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
