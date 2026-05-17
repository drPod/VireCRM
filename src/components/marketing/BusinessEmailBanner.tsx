import { Mail } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/config/support";

/**
 * BusinessEmailBanner — slim, always-visible bar at the very top of every
 * public marketing page. Surfaces the official Majix business email so
 * prospects always know how to reach us, even if they never scroll to the
 * footer or open Contact. Sits ABOVE the PromoBanner.
 */
export function BusinessEmailBanner() {
  return (
    <div className="border-b border-white/10 bg-[oklch(0.12_0.02_260)]">
      <a
        href={SUPPORT_MAILTO}
        className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-1.5 text-center text-[11px] font-medium text-white/90 transition-colors hover:text-white sm:text-xs"
      >
        <Mail className="h-3 w-3 shrink-0 text-primary" />
        <span className="hidden sm:inline">Questions? Reach our team at</span>
        <span className="sm:hidden">Email us:</span>
        <span className="font-semibold text-white">{SUPPORT_EMAIL}</span>
      </a>
    </div>
  );
}
