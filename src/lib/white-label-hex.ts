/**
 * Strict 3- or 6-digit hex with leading #. 4/8-digit (alpha) hex is rejected
 * because the theming engine's luminance math expects RGB only.
 */
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}
