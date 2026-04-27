import { describe, it, expect } from "vitest";
import { whiteLabelTiers, crmTiers, type PricingTier } from "./PricingCards";
import { applyPromoDiscount } from "./PromoBanner";

/**
 * Mirrors the discount-decision rule used inside TierCard:
 *   const discounted = tier.excludeFromPromo ? null : applyPromoDiscount(displayedPrice);
 * If this rule changes in PricingCards.tsx, this helper must change too.
 */
function resolveDiscount(tier: PricingTier): string | null {
  return tier.excludeFromPromo ? null : applyPromoDiscount(tier.price);
}

describe("PricingCards promo discount exclusion", () => {
  it("Custom Enterprise tier is marked excludeFromPromo", () => {
    const enterprise = whiteLabelTiers.find((t) => t.name === "Custom Enterprise");
    expect(enterprise, "Custom Enterprise tier must exist").toBeDefined();
    expect(enterprise!.excludeFromPromo).toBe(true);
    expect(enterprise!.price).toBe("$14,000+");
  });

  it("does not compute a discounted price for excludeFromPromo tiers", () => {
    const excluded = [...crmTiers, ...whiteLabelTiers].filter((t) => t.excludeFromPromo);
    expect(excluded.length).toBeGreaterThan(0);
    for (const tier of excluded) {
      expect(resolveDiscount(tier), `${tier.name} must not show a discounted price`).toBeNull();
    }
  });

  it("would otherwise discount Custom Enterprise to $9,800+ if not excluded — confirms the guard matters", () => {
    // Sanity check: without the exclusion guard, the displayed price would drop
    // to the promo number we don't want shown.
    expect(applyPromoDiscount("$14,000+")).toBe("$9,800+");
  });

  it("still applies the discount to normal (non-excluded) numeric tiers", () => {
    const normal = [...crmTiers, ...whiteLabelTiers].filter(
      (t) => !t.excludeFromPromo && /^\$\d/.test(t.price),
    );
    expect(normal.length).toBeGreaterThan(0);
    for (const tier of normal) {
      expect(resolveDiscount(tier), `${tier.name} should be discounted`).not.toBeNull();
    }
  });
});
