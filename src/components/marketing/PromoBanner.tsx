import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

/**
 * Sitewide promo banner — 30% off everything.
 * Shown above the marketing header. Uses primary gradient for emphasis.
 */
export function PromoBanner() {
  return (
    <div className="fixed top-[28px] z-[60] w-full bg-gradient-to-r from-primary via-[oklch(0.65_0.18_290)] to-[oklch(0.65_0.16_320)] text-white">
      <Link
        to="/pricing"
        className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-2 text-center text-xs font-medium sm:text-sm"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-bold">30% OFF EVERYTHING</span>
          <span className="hidden sm:inline"> — limited time launch promo. Discount applied automatically at checkout.</span>
        </span>
        <span className="hidden underline-offset-2 hover:underline sm:inline">View plans →</span>
      </Link>
    </div>
  );
}

/** Discount rate applied to all displayed prices. 0.30 = 30% off. */
export const PROMO_DISCOUNT = 0.30;

/**
 * Apply the promo discount to a price string like "$97" or "$297–$497".
 * Returns null when the price isn't numeric (e.g. "Custom", "$14,000+").
 */
export function applyPromoDiscount(price: string): string | null {
  const range = price.match(/^\$(\d[\d,]*)\s*[–-]\s*\$(\d[\d,]*)$/);
  if (range) {
    const lo = Math.round(Number(range[1].replace(/,/g, "")) * (1 - PROMO_DISCOUNT));
    const hi = Math.round(Number(range[2].replace(/,/g, "")) * (1 - PROMO_DISCOUNT));
    return `$${lo.toLocaleString()}–$${hi.toLocaleString()}`;
  }
  // Open-ended price like "$14,000+" — discount the floor and keep the "+".
  const openEnded = price.match(/^\$(\d[\d,]*)\+$/);
  if (openEnded) {
    const n = Math.round(Number(openEnded[1].replace(/,/g, "")) * (1 - PROMO_DISCOUNT));
    return `$${n.toLocaleString()}+`;
  }
  const single = price.match(/^\$(\d[\d,]*)$/);
  if (single) {
    const n = Math.round(Number(single[1].replace(/,/g, "")) * (1 - PROMO_DISCOUNT));
    return `$${n.toLocaleString()}`;
  }
  return null;
}
