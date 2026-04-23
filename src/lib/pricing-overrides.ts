/**
 * Runtime price overrides for marketing pricing tiers.
 *
 * Displayed tier prices live in source (`crmTiers` / `whiteLabelTiers` in
 * `PricingCards.tsx`). When Stripe drifts from the displayed value, the
 * Pricing Consistency Check can auto-write an override here so the marketing
 * page renders the corrected amount without a code edit.
 *
 * Stored in localStorage as { [stripePriceId]: { price: "$129", updatedAt } }.
 */

const STORAGE_KEY = "vireon.pricing-overrides.v1";

export interface PriceOverride {
  /** Display string, e.g. "$129". Always currency + integer when set by auto-sync. */
  price: string;
  /** ISO timestamp of when the override was written. */
  updatedAt: string;
  /** Cents value the override was derived from (for audit). */
  cents: number;
  /** Currency code recorded at write time. */
  currency: string;
}

export type PriceOverrideMap = Record<string, PriceOverride>;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// Lookup keys whose stored overrides should always be discarded on load.
// Use this when the source-of-truth price in code is intentionally changed
// and any prior auto-sync override would mask the new value.
const STALE_OVERRIDE_KEYS = new Set<string>([
  "crm_starter_monthly",
  "crm_growth_monthly",
  "crm_pro_monthly",
  "lease_starter_monthly",
  "lease_pro_monthly",
]);

export function loadOverrides(): PriceOverrideMap {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PriceOverrideMap;
    if (!parsed || typeof parsed !== "object") return {};
    let mutated = false;
    for (const key of STALE_OVERRIDE_KEYS) {
      if (key in parsed) {
        delete parsed[key];
        mutated = true;
      }
    }
    if (mutated) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // ignore quota / privacy errors
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveOverrides(map: PriceOverrideMap): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("vireon:pricing-overrides-changed"));
  } catch {
    // Ignore quota / privacy errors — overrides simply won't persist.
  }
}

export function clearOverrides(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("vireon:pricing-overrides-changed"));
}

/**
 * Format integer cents as a USD-style display string matching the existing
 * tier price convention (e.g. 12900 → "$129", 12950 → "$129.50").
 */
export function formatCentsForDisplay(cents: number, currency: string): string {
  const symbol = currency.toUpperCase() === "USD" ? "$" : "";
  const dollars = cents / 100;
  if (Number.isInteger(dollars)) {
    return `${symbol}${dollars.toLocaleString()}${symbol ? "" : ` ${currency.toUpperCase()}`}`;
  }
  return `${symbol}${dollars.toFixed(2)}${symbol ? "" : ` ${currency.toUpperCase()}`}`;
}

/**
 * Resolve the displayed price for a tier, applying any active override.
 * Returns the original `defaultPrice` when no override exists.
 */
export function getDisplayedPrice(stripePriceId: string | undefined, defaultPrice: string): string {
  if (!stripePriceId) return defaultPrice;
  const overrides = loadOverrides();
  return overrides[stripePriceId]?.price ?? defaultPrice;
}
