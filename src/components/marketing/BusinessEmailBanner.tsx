import { Mail } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/config/support";

/**
 * BusinessEmailBanner — slim, always-visible bar at the very top of every
 * public marketing page. Surfaces the official Genesis business email so
 * prospects always know how to reach us, even if they never scroll to the
 * footer or open Contact. Sits ABOVE the PromoBanner.
 */
export function BusinessEmailBanner() {
  return (
    <div className="fixed top-0 z-[70] w-full border-b border-white/10 bg-[oklch(0.12_0.02_260)] text-foreground">
      <a
        href={SUPPORT_MAILTO}
        className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-1.5 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
      >
        <Mail className="h-3 w-3 shrink-0 text-primary" />
        <span className="hidden sm:inline">Questions? Reach our team at</span>
        <span className="sm:hidden">Email us:</span>
        <span className="font-semibold text-foreground">{SUPPORT_EMAIL}</span>
      </a>
    </div>
  );
}

/** Pixel height of the banner — used by other fixed elements to offset their top. */
export const BUSINESS_EMAIL_BANNER_HEIGHT = 28;
