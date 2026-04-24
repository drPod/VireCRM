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
