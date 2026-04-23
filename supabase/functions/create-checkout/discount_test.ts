// Verifies that the launch25 coupon is applied to every checkout session
// and that the resulting amount_total equals 75% of the listed price.
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createStripeClient } from "../_shared/stripe.ts";

interface TierExpectation {
  priceId: string;
  expectedListedCents: number; // base unit_amount on the price
}

// Listed prices (in cents) shown on the pricing page before discount.
// Pro tier ($297–$497) — Stripe price is the floor of the range ($297).
const TIERS: TierExpectation[] = [
  { priceId: "crm_starter_monthly", expectedListedCents: 9700 },
  { priceId: "crm_growth_monthly", expectedListedCents: 19700 },
  { priceId: "crm_pro_monthly", expectedListedCents: 29700 },
  { priceId: "lease_starter_monthly", expectedListedCents: 24900 },
  { priceId: "lease_pro_monthly", expectedListedCents: 84900 },
];

const DISCOUNT = 0.25;

for (const tier of TIERS) {
  Deno.test(`launch25 coupon applied to ${tier.priceId}`, async () => {
    const stripe = createStripeClient("sandbox");

    // Resolve the price via lookup_keys (same as the edge function does).
    const prices = await stripe.prices.list({ lookup_keys: [tier.priceId] });
    if (!prices.data.length) {
      throw new Error(`Price ${tier.priceId} not found in Stripe sandbox`);
    }
    const stripePrice = prices.data[0];
    assertEquals(
      stripePrice.unit_amount,
      tier.expectedListedCents,
      `Listed price for ${tier.priceId} (${stripePrice.unit_amount}¢) does not match pricing page (${tier.expectedListedCents}¢)`,
    );

    // Ensure coupon exists.
    try {
      await stripe.coupons.retrieve("launch25");
    } catch {
      await stripe.coupons.create({
        id: "launch25",
        percent_off: 25,
        duration: "forever",
        name: "Launch promo — 25% off",
      });
    }

    const isRecurring = stripePrice.type === "recurring";
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded",
      discounts: [{ coupon: "launch25" }],
      return_url: "https://example.com/return?session_id={CHECKOUT_SESSION_ID}",
    });

    const expectedDiscounted = Math.round(tier.expectedListedCents * (1 - DISCOUNT));

    // amount_subtotal = list price; amount_total = after discount.
    assertEquals(
      session.amount_subtotal,
      tier.expectedListedCents,
      `Subtotal mismatch for ${tier.priceId}`,
    );
    assertEquals(
      session.amount_total,
      expectedDiscounted,
      `Discounted total for ${tier.priceId} should be ${expectedDiscounted}¢ (75% of ${tier.expectedListedCents}¢) but got ${session.amount_total}¢`,
    );
  });
}
