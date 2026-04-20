import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Plays a quick fade-in on route changes WITHOUT unmounting the subtree.
 *
 * Previous implementation used `key={pathname}` which forced React to
 * unmount/remount the entire page tree (including heavy headers/footers)
 * on every navigation, causing visible lag. This version restarts the CSS
 * animation imperatively (remove + force reflow + re-add class) so the
 * DOM is reused and only the cheap fade plays.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("page-transition");
    // Force reflow so the browser registers the class removal before re-adding.
    void el.offsetWidth;
    el.classList.add("page-transition");
  }, [pathname]);

  return (
    <div ref={ref} className="page-transition">
      {children}
    </div>
  );
}
