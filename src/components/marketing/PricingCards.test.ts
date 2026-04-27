import { describe, it, expect } from "vitest";
import { whiteLabelTiers, crmTiers, type PricingTier } from "./PricingCards";
import { applyPromoDiscount } from "./PromoBanner";

function resolveDiscount(tier: PricingTier): string | null {
  return tier.excludeFromPromo ? null : applyPromoDiscount(tier.price);
}

describe("PricingCards promo discount exclusion", () => {
  it("Custom CRM, Full Ownership, and Custom Enterprise are excluded from promo", () => {
    const excludedNames = ["Custom CRM", "Full Ownership", "Custom Enterprise"];
    for (const name of excludedNames) {
      const tier = [...crmTiers, ...whiteLabelTiers].find((t) => t.name === name);
      expect(tier, `${name} must exist`).toBeDefined();
      expect(tier!.excludeFromPromo, `${name} must be excluded from promo`).toBe(true);
      expect(resolveDiscount(tier!), `${name} must not show a discounted price`).toBeNull();
    }
  });

  it("Custom Enterprise is priced at $7,000+", () => {
    const enterprise = whiteLabelTiers.find((t) => t.name === "Custom Enterprise");
    expect(enterprise!.price).toBe("$7,000+");
  });

  it("still applies the 30% discount to normal numeric tiers", () => {
    const normal = [...crmTiers, ...whiteLabelTiers].filter(
      (t) => !t.excludeFromPromo && /^\$\d/.test(t.price),
    );
    expect(normal.length).toBeGreaterThan(0);
    for (const tier of normal) {
      expect(resolveDiscount(tier), `${tier.name} should be discounted`).not.toBeNull();
    }
  });
});
