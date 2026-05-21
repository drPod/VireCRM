import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];

/**
 * Branding columns pulled from `organizations` to power outreach email
 * delivery (subject line "from" name, header logo, body accent color,
 * default font, signature block). Replaces the previous pattern of
 * inline `.select("name, brand_name, …")` + `(org as any).<field>` casts
 * across server functions.
 */
export type OrgBranding = Pick<
  OrgRow,
  | "name"
  | "brand_name"
  | "support_email"
  | "logo_url"
  | "primary_color"
  | "font_family"
  | "email_signature"
>;

const ORG_BRANDING_SELECT =
  "name, brand_name, support_email, logo_url, primary_color, font_family, email_signature" as const;

/**
 * Fetch the branding-relevant columns for an org. Returns `null` if the
 * row isn't visible (RLS-aware when called via the user's client) — caller
 * decides whether to throw or fall back to platform defaults.
 *
 * Uses `.maybeSingle()` so a missing row is `null` instead of a thrown
 * Supabase error; matches the existing call-site behaviour in
 * `outreach-preview.functions.ts`.
 */
export async function fetchOrgBranding(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<OrgBranding | null> {
  const { data } = await supabase
    .from("organizations")
    .select(ORG_BRANDING_SELECT)
    .eq("id", orgId)
    .maybeSingle();
  return data;
}

/**
 * AI usage counters for an org. Separate helper because token-budget
 * enforcement is a different concern from branding — pulled together
 * historically in `auto-outreach.functions.ts` to save a roundtrip, but
 * call sites that only need branding (`outreach-preview`,
 * `send-followup-suggestions`) shouldn't have to know these columns
 * exist.
 */
export type OrgAiUsage = Pick<OrgRow, "ai_tokens_used" | "ai_tokens_limit">;

export async function fetchOrgAiUsage(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<OrgAiUsage | null> {
  const { data } = await supabase
    .from("organizations")
    .select("ai_tokens_used, ai_tokens_limit")
    .eq("id", orgId)
    .maybeSingle();
  return data;
}
