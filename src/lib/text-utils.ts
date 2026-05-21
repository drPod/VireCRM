/**
 * Strip HTML markup and decode common entities, returning a compact plain-text
 * version suitable for previews and line-clamped UI. Preserves paragraph breaks
 * by converting block-level tags to newlines before tag stripping.
 */
export function htmlToPlainText(input: string): string {
  if (!input) return "";
  // Strip script/style blocks entirely
  let s = input.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  // Convert common block tags to newlines so paragraphs don't run together
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|br)\s*>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Strip all remaining tags
  s = s.replace(/<[^>]+>/g, "");
  // Decode the most common HTML entities
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  // Collapse whitespace
  s = s
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}
