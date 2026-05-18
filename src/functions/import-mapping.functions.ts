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

type FieldSource = { kind: "header"; key: string } | { kind: "index"; index: number } | null;

export interface ImportColumnMapping {
  /** Field-to-source mapping. Source is either a header key or a positional column index. */
  fields: {
    name?: FieldSource;
    email?: FieldSource;
    phone?: FieldSource;
    company?: FieldSource;
    status?: FieldSource;
    notes?: FieldSource;
    source?: FieldSource;
    // Energy-broker fields (Step 3). All optional — only Texas energy-broker
    // sheets carry these; standard contact imports leave them null.
    title?: FieldSource;
    deal_name?: FieldSource;
    service_address?: FieldSource;
    esi_id?: FieldSource;
    annual_kwh?: FieldSource;
    current_supplier?: FieldSource;
    contract_start_date?: FieldSource;
    contract_end_date?: FieldSource;
    cost_per_kwh?: FieldSource;
    agent_mils?: FieldSource;
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
      .map(
        (row, idx) =>
          `Row ${idx + 1}: ${row.map((v, i) => `[${i}] ${truncate(v, 60)}`).join(" | ")}`,
      )
      .join("\n");

    const result = await callAiWithFallback<{
      name_source?: string | null;
      email_source?: string | null;
      phone_source?: string | null;
      company_source?: string | null;
      status_source?: string | null;
      notes_source?: string | null;
      source_source?: string | null;
      title_source?: string | null;
      deal_name_source?: string | null;
      service_address_source?: string | null;
      esi_id_source?: string | null;
      annual_kwh_source?: string | null;
      current_supplier_source?: string | null;
      contract_start_date_source?: string | null;
      contract_end_date_source?: string | null;
      cost_per_kwh_source?: string | null;
      agent_mils_source?: string | null;
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
      systemPrompt: `You map messy spreadsheet columns to a CRM lead schema. Some tenants are Texas energy brokers, so the schema includes energy-contract fields alongside standard contact fields.

Standard contact fields:
- name (REQUIRED — the contact's full name; can be assembled from first/last name columns if a single column has full name)
- email
- phone
- company / organization
- title (contact's job title at their company, e.g. "Owner", "CFO", "Facilities Manager")
- status (new, contacted, qualified, negotiation, won, lost)
- notes / description / comments
- source (where the LEAD came from — referral, website, csv_import, etc. Do NOT confuse with energy supplier.)

Energy-broker fields (leave null when sheet is a plain contact import):
- deal_name — per-deal label set by the broker, e.g. "ACME HQ Renewal", "Smith Bakery 2026"
- service_address — physical address of the metered location (often "Service Address", "Premises Address", "Site Address", or just "Address")
- esi_id — Texas ESID (Electric Service Identifier). 17-digit meter number, usually starts with "1044…" in Crystal's data. Headers: "ESI", "ESID", "ESI Number", "Meter Number", "Meter #". Critical field — never miss it when it's in the sheet.
- annual_kwh — annual electricity usage in kilowatt-hours. Headers: "Annual Usage", "Annual kWh", "Usage", "kWh", "kWh/yr".
- current_supplier — the energy retailer (TXU, Reliant, Constellation, Direct Energy, NRG, etc.). Headers: "Supplier", "Current Supplier", "REP", "Provider". This is the ENERGY supplier, NOT the lead source.
- contract_start_date — start date of the supply contract. Headers: "Contract Start", "Start Date", "Effective Date", "CSD".
- contract_end_date — end date of the supply contract. Headers: "Contract End", "End Date", "Expiration", "CED".
- cost_per_kwh — supplier's wholesale rate in $/kWh, e.g. 0.085. Headers: "Cost per kWh", "Rate", "Supplier Rate", "$/kWh", "Price per kWh".
- agent_mils — broker commission in mils ($0.001/kWh units). Numeric, often a small integer like 2, 3, 4. Headers: "Mils", "Agent Mils", "Broker Mils", "Margin", "Spread".

Rules:
1. Each *_source value must be EITHER:
   - The exact header string from the "Detected headers" list, OR
   - A positional reference like "#0", "#1", "#2" pointing at a column index from the sample rows.
2. Use null when no column maps to that field. Leave energy fields null on plain contact imports.
3. Set row_one_is_data=true when the "headers" list is clearly data (numbers, dates, person names, addresses) rather than column labels — this means there's no real header row and we should treat all rows as data.
4. Set row_one_is_data=false when the headers look like real labels (e.g. "Name", "Email", "Phone", "Company").
5. Prefer header strings over indices when a real header exists.
6. The "name" field is required — pick the column with full names or the most name-like column. If the data has separate first/last name columns, pick the one closer to a full name.
7. Disambiguate supplier vs source: "Supplier"/"REP"/"Provider" → current_supplier; "Source"/"Lead Source"/"Origin" → source.
8. Disambiguate company vs deal_name: "Company"/"Organization"/"Account" → company; "Deal"/"Opportunity"/"Deal Name" → deal_name.
9. Keep explanation under 200 characters.`,
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
          title_source: { type: ["string", "null"] },
          deal_name_source: { type: ["string", "null"] },
          service_address_source: { type: ["string", "null"] },
          esi_id_source: { type: ["string", "null"] },
          annual_kwh_source: { type: ["string", "null"] },
          current_supplier_source: { type: ["string", "null"] },
          contract_start_date_source: { type: ["string", "null"] },
          contract_end_date_source: { type: ["string", "null"] },
          cost_per_kwh_source: { type: ["string", "null"] },
          agent_mils_source: { type: ["string", "null"] },
          row_one_is_data: { type: "boolean" },
          explanation: { type: "string" },
        },
        required: ["row_one_is_data", "explanation"],
      },
    });

    const resolve = (raw: string | null | undefined): FieldSource => {
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
        title: resolve(result.title_source),
        deal_name: resolve(result.deal_name_source),
        service_address: resolve(result.service_address_source),
        esi_id: resolve(result.esi_id_source),
        annual_kwh: resolve(result.annual_kwh_source),
        current_supplier: resolve(result.current_supplier_source),
        contract_start_date: resolve(result.contract_start_date_source),
        contract_end_date: resolve(result.contract_end_date_source),
        cost_per_kwh: resolve(result.cost_per_kwh_source),
        agent_mils: resolve(result.agent_mils_source),
      },
      rowOneIsData: result.row_one_is_data,
      explanation: result.explanation,
    };
  });

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
