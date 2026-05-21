/**
 * Header-name dictionaries used by the heuristic column detector in
 * `csv-parser.ts` / `xlsx-parser.ts`, plus the AI-mapping fallback in
 * `builder.ts`. All strings are pre-normalized (lowercased, trimmed, quotes
 * stripped) — match against `normalizeHeader(raw)`.
 */

export const VALID_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "negotiation",
  "won",
  "lost",
] as const;

/** Same RFC-5322-lite check used everywhere else in the app. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NAME_HEADERS = ["name", "full name", "fullname", "contact", "lead"];
export const EMAIL_HEADERS = ["email", "e-mail", "email address"];
export const PHONE_HEADERS = ["phone", "telephone", "tel", "mobile", "phone number"];
export const COMPANY_HEADERS = ["company", "organization", "org", "business", "company name"];
export const STATUS_HEADERS = ["status", "stage", "lead status"];
export const SCORE_HEADERS = ["score", "lead score", "rating"];
export const NOTES_HEADERS = ["notes", "note", "comments", "description"];
export const SOURCE_HEADERS = ["source", "lead source", "origin", "channel"];
export const ANNUAL_KWH_HEADERS = [
  "annual kwh",
  "annual usage",
  "annual usage kwh",
  "kwh",
  "yearly kwh",
  "yearly usage",
  "consumption",
  "annual consumption",
  "usage",
  "usage kwh",
];
export const CONTRACT_END_HEADERS = [
  "contract end",
  "contract end date",
  "contract expiry",
  "contract expiration",
  "expiry date",
  "expiration date",
  "renewal date",
  "end date",
  "ced",
];
export const SUPPLIER_HEADERS = [
  "current supplier",
  "supplier",
  "energy supplier",
  "utility",
  "utility provider",
  "provider",
  "incumbent supplier",
  "current provider",
];
export const ESI_HEADERS = [
  "esi",
  "esi id",
  "esi number",
  "esid",
  "meter",
  "meter number",
  "meter #",
  "esi #",
];
export const ADDRESS_HEADERS = [
  "address",
  "service address",
  "premises address",
  "site address",
  "location",
  "premise address",
];
export const TITLE_HEADERS = ["title", "job title", "role", "position"];
export const DEAL_NAME_HEADERS = ["deal name", "deal", "opportunity", "opportunity name"];
export const CONTRACT_START_HEADERS = [
  "contract start",
  "contract start date",
  "start date",
  "effective date",
  "csd",
];
export const COST_PER_KWH_HEADERS = [
  "cost per kwh",
  "rate",
  "supplier rate",
  "cost/kwh",
  "price per kwh",
  "$/kwh",
  "cost",
];
export const MILS_HEADERS = ["mils", "agent mils", "broker mils", "margin", "spread"];

export const normalizeHeader = (key: string) => key.trim().toLowerCase().replace(/['"]/g, "");

/**
 * Resolve every canonical lead field to a column index by matching each
 * field's header dictionary against `normalizedHeaders`. Returns -1 for
 * any field whose header isn't present. Shared between `parseCSV` and
 * `parseXLSX` so both formats use identical heuristics.
 */
export function detectColumnIndices(normalizedHeaders: string[]) {
  const find = (dict: readonly string[]) => normalizedHeaders.findIndex((h) => dict.includes(h));
  return {
    nameIdx: find(NAME_HEADERS),
    emailIdx: find(EMAIL_HEADERS),
    phoneIdx: find(PHONE_HEADERS),
    companyIdx: find(COMPANY_HEADERS),
    statusIdx: find(STATUS_HEADERS),
    scoreIdx: find(SCORE_HEADERS),
    notesIdx: find(NOTES_HEADERS),
    sourceIdx: find(SOURCE_HEADERS),
    titleIdx: find(TITLE_HEADERS),
    dealNameIdx: find(DEAL_NAME_HEADERS),
    addressIdx: find(ADDRESS_HEADERS),
    esiIdx: find(ESI_HEADERS),
    annualKwhIdx: find(ANNUAL_KWH_HEADERS),
    contractStartIdx: find(CONTRACT_START_HEADERS),
    contractEndIdx: find(CONTRACT_END_HEADERS),
    supplierIdx: find(SUPPLIER_HEADERS),
    costPerKwhIdx: find(COST_PER_KWH_HEADERS),
    milsIdx: find(MILS_HEADERS),
  };
}
