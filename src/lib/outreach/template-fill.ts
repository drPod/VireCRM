/**
 * Substitute `{{placeholder}}` tokens in an outreach template with lead data.
 *
 * Used both as a fast offline fill (no AI) and as the seed string handed to
 * the AI when it personalizes a template. Keeping the substitution logic
 * here so client preview, server preview, and bulk outreach all behave
 * identically.
 *
 * Supported tokens (case-insensitive, surrounding whitespace tolerated):
 *   {{name}} | {{full_name}}     → lead's full name
 *   {{first_name}}               → first word of name
 *   {{last_name}}                → last word of name (or blank if single)
 *   {{company}}                  → company / org name (or "your company")
 *   {{role}} | {{title}}         → job title (or "your role")
 *   {{email}}                    → email
 *   {{business_name}}            → sender's brand/business name
 *
 * Unknown tokens are left intact so the AI/user can spot typos.
 */

export interface LeadFillContext {
  name?: string | null;
  email?: string | null;
  company?: string | null;
  role?: string | null;
}

export interface FillContext extends LeadFillContext {
  businessName?: string | null;
}

function splitName(full: string | null | undefined) {
  const safe = (full ?? "").trim();
  if (!safe) return { first: "", last: "" };
  const parts = safe.split(/\s+/);
  return {
    first: parts[0] ?? "",
    last: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

export function fillTemplateTokens(input: string, ctx: FillContext): string {
  const { first, last } = splitName(ctx.name);
  const map: Record<string, string> = {
    name: ctx.name?.trim() || first || "there",
    full_name: ctx.name?.trim() || first || "there",
    first_name: first || ctx.name?.trim() || "there",
    last_name: last,
    company: ctx.company?.trim() || "your company",
    role: ctx.role?.trim() || "your role",
    title: ctx.role?.trim() || "your role",
    email: ctx.email?.trim() || "",
    business_name: ctx.businessName?.trim() || "",
  };

  return input.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, raw: string) => {
    const key = raw.toLowerCase();
    if (key in map) return map[key];
    return match;
  });
}

/**
 * Helper: snapshot of the placeholder tokens we officially support, so the
 * UI can show a hint chip list under the template editor.
 */
export const TEMPLATE_TOKENS = [
  "{{first_name}}",
  "{{name}}",
  "{{company}}",
  "{{role}}",
  "{{email}}",
  "{{business_name}}",
] as const;
