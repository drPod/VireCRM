import { describe, it, expect } from "vitest";
import { whiteLabelTiers } from "./PricingCards";

describe("PricingCards — promo removed", () => {
  it("Custom Enterprise tier is priced at $7,000+ with no promo flag", () => {
    const enterprise = whiteLabelTiers.find((t) => t.name === "Custom Enterprise");
    expect(enterprise, "Custom Enterprise tier must exist").toBeDefined();
    expect(enterprise!.price).toBe("$7,000+");
    expect(enterprise!.excludeFromPromo).toBeUndefined();
  });
});
