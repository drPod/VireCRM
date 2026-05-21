/**
 * Credit-pack catalog + label/price helpers shared across the billing surface
 * (CreditTopUpPanel, CreditLedgerTimeline). Prices stored as integer cents.
 */

export type CreditPack = {
  key: string;
  label: string;
  credits: number;
  priceCents: number;
  highlight?: boolean;
};

export const CREDIT_PACKS: CreditPack[] = [
  { key: "credit_pack_small_onetime", label: "Starter", credits: 100, priceCents: 1500 },
  { key: "credit_pack_medium_onetime", label: "Growth", credits: 500, priceCents: 6000 },
  {
    key: "credit_pack_large_onetime",
    label: "Pro",
    credits: 2000,
    priceCents: 20000,
    highlight: true,
  },
  { key: "credit_pack_bulk_onetime", label: "Bulk", credits: 10000, priceCents: 80000 },
];

export const DEFAULT_AUTO_PACK = "credit_pack_medium_onetime";

/** Whole-dollar label for pack price tiles (e.g. `$15`, `$80,000`). */
export function formatPackPrice(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

/** Per-credit price (e.g. `$0.150/credit`). */
export function perCredit(cents: number, credits: number) {
  return `$${(cents / 100 / credits).toFixed(3)}/credit`;
}

export function packLabel(key: string): string {
  return CREDIT_PACKS.find((p) => p.key === key)?.label ?? key;
}
