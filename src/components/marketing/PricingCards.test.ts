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

  /**
   * Structural guarantee that the Stripe `launch30` coupon can never be
   * applied to an excluded tier:
   *
   *   1. `create-checkout` ALWAYS attaches `discounts: [{ coupon: "launch30" }]`
   *      to every session it creates (see supabase/functions/create-checkout/index.ts).
   *   2. The only way to invoke that function is via a tier's `stripePriceId`
   *      (see TierCard's onCheckout handler — it early-returns when undefined).
   *   3. Therefore, if every excluded tier has NO `stripePriceId` AND uses the
   *      "Contact Us" CTA (which routes to a phone call, not checkout), the
   *      coupon physically cannot reach Stripe for those tiers.
   *
   * This test asserts (3). If anyone later adds a `stripePriceId` to an
   * excluded tier, this fails loudly — preventing a regression where the
   * promo coupon would silently apply to a tier that's supposed to be full-price.
   */
  it("excluded tiers cannot reach Stripe checkout (no stripePriceId, Contact Us CTA)", () => {
    const excluded = [...crmTiers, ...whiteLabelTiers].filter((t) => t.excludeFromPromo);
    expect(excluded.length).toBeGreaterThan(0);
    for (const tier of excluded) {
      expect(
        tier.stripePriceId,
        `${tier.name} must NOT have a stripePriceId — otherwise the launch30 coupon would apply`,
      ).toBeUndefined();
      expect(
        tier.cta,
        `${tier.name} must use the "Contact Us" CTA so it bypasses checkout entirely`,
      ).toBe("Contact Us");
    }
  });
});
