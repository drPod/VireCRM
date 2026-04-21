import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAiWithFallback, DEFAULT_TEXT_MODELS } from "@/lib/ai-gateway";
import { z } from "zod";

/**
 * AI-powered column mapper for spreadsheet imports.
 *
 * Used as a fallback when the import dialog can't find a recognizable "Name"
 * header. The user's file might:
 *   - Have non-standard column names ("Contact Person", "Lead Full Name")
 *   - Be in a non-English language
 *   - Have NO header row at all (row 1 is data)
 *
 * The AI receives the detected header keys and the first ~5 rows, then returns
 * a mapping from each canonical lead field to either a header key (string) or
 * a positional column index (number) — plus a flag telling us whether row 1
 * should be treated as data or skipped as a header row.
 */

const inputSchema = z.object({
  headers: z.array(z.string()).max(200),
  // Up to 5 sample rows of stringified cell values
  sampleRows: z.array(z.array(z.string())).max(5),
});

export interface ImportColumnMapping {
  /** Field-to-source mapping. Source is either a header key or a positional column index. */
  fields: {
    name?: { kind: "header"; key: string } | { kind: "index"; index: number } | null;
    email?: { kind: "header"; key: string } | { kind: "index"; index: number } | null;
    phone?: { kind: "header"; key: string } | { kind: "index"; index: number } | null;
    company?: { kind: "header"; key: string } | { kind: "index"; index: number } | null;
    status?: { kind: "header"; key: string } | { kind: "index"; index: number } | null;
    notes?: { kind: "header"; key: string } | { kind: "index"; index: number } | null;
    source?: { kind: "header"; key: string } | { kind: "index"; index: number } | null;
  };
  /** True when row 1 looks like data, not headers. Caller should NOT skip it. */
  rowOneIsData: boolean;
  /** Short human-readable explanation of how the AI mapped things. */
  explanation: string;
}

export const mapImportColumnsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof inputSchema>) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ImportColumnMapping> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) throw new Error("No organization found for user");

    // Build a compact preview the AI can reason about. We limit row width
    // because some imports have 100+ junk columns and we only need the gist.
    const MAX_COLS = 40;
    const trimmedHeaders = data.headers.slice(0, MAX_COLS);
    const previewRows = data.sampleRows
      .map((row) => row.slice(0, MAX_COLS))
      .map((row, idx) => `Row ${idx + 1}: ${row.map((v, i) => `[${i}] ${truncate(v, 60)}`).join(" | ")}`)
      .join("\n");

    const result = await callAiWithFallback<{
      name_source?: string | null;
      email_source?: string | null;
      phone_source?: string | null;
      company_source?: string | null;
      status_source?: string | null;
      notes_source?: string | null;
      source_source?: string | null;
      row_one_is_data: boolean;
      explanation: string;
    }>({
      featureLabel: "Import column mapper",
      models: DEFAULT_TEXT_MODELS,
      organizationId: profile.organization_id,
      userId,
      toolName: "map_import_columns",
      toolDescription:
        "Map spreadsheet columns to lead CRM fields. Each *_source value is either the literal header text (string) or a positional column index in the form '#N' (e.g. '#0', '#3'). Use null when the field is not present. row_one_is_data must be true when the values in row 1 look like real data (numbers, dates, names) rather than column labels.",
      systemPrompt: `You map messy spreadsheet columns to a CRM lead schema.

Lead fields you can map:
- name (REQUIRED — the contact's full name; can be assembled from first/last name columns if a single column has full name)
- email
- phone
- company / organization
- status (new, contacted, qualified, negotiation, won, lost)
- notes / description / comments
- source (where the lead came from — referral, website, csv_import, etc.)

Rules:
1. Each *_source value must be EITHER:
   - The exact header string from the "Detected headers" list, OR
   - A positional reference like "#0", "#1", "#2" pointing at a column index from the sample rows.
2. Use null when no column maps to that field.
3. Set row_one_is_data=true when the "headers" list is clearly data (numbers, dates, person names, addresses) rather than column labels — this means there's no real header row and we should treat all rows as data.
4. Set row_one_is_data=false when the headers look like real labels (e.g. "Name", "Email", "Phone", "Company").
5. Prefer header strings over indices when a real header exists.
6. The "name" field is required — pick the column with full names or the most name-like column. If the data has separate first/last name columns, pick the one closer to a full name.
7. Keep explanation under 200 characters.`,
      userPrompt: `Detected headers (${trimmedHeaders.length}): ${trimmedHeaders.map((h, i) => `[${i}] "${truncate(h, 60)}"`).join(", ")}

First ${data.sampleRows.length} data row${data.sampleRows.length === 1 ? "" : "s"}:
${previewRows}`,
      toolSchema: {
        type: "object",
        properties: {
          name_source: { type: ["string", "null"] },
          email_source: { type: ["string", "null"] },
          phone_source: { type: ["string", "null"] },
          company_source: { type: ["string", "null"] },
          status_source: { type: ["string", "null"] },
          notes_source: { type: ["string", "null"] },
          source_source: { type: ["string", "null"] },
          row_one_is_data: { type: "boolean" },
          explanation: { type: "string" },
        },
        required: ["row_one_is_data", "explanation"],
      },
    });

    const resolve = (
      raw: string | null | undefined,
    ): { kind: "header"; key: string } | { kind: "index"; index: number } | null => {
      if (!raw) return null;
      const trimmed = raw.trim();
      if (!trimmed) return null;

      // Positional reference: "#N"
      const posMatch = trimmed.match(/^#(\d+)$/);
      if (posMatch) {
        const idx = parseInt(posMatch[1], 10);
        if (Number.isFinite(idx) && idx >= 0 && idx < trimmedHeaders.length) {
          return { kind: "index", index: idx };
        }
        return null;
      }

      // Header reference — match case-insensitively and trim whitespace
      const lowered = trimmed.toLowerCase();
      const matchIdx = trimmedHeaders.findIndex((h) => h.toLowerCase().trim() === lowered);
      if (matchIdx >= 0) {
        return { kind: "header", key: trimmedHeaders[matchIdx] };
      }
      // AI hallucinated a header — fall back to null rather than crash.
      return null;
    };

    return {
      fields: {
        name: resolve(result.name_source),
        email: resolve(result.email_source),
        phone: resolve(result.phone_source),
        company: resolve(result.company_source),
        status: resolve(result.status_source),
        notes: resolve(result.notes_source),
        source: resolve(result.source_source),
      },
      rowOneIsData: result.row_one_is_data,
      explanation: result.explanation,
    };
  });

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
