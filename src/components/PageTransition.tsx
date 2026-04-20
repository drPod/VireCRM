import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Plays a quick fade-in on route changes WITHOUT unmounting the subtree.
 *
 * Previous implementation used `key={pathname}` which forced React to
 * unmount/remount the entire page tree (including heavy headers/footers)
 * on every navigation, causing visible lag. This version restarts the CSS
 * animation by toggling a class via a state flip, so the DOM is reused
 * and only the cheap fade plays.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [tick, setTick] = useState(0);
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setTick((t) => t + 1);
    }
  }, [pathname]);

  // `tick` in the key only wraps a tiny inner span, not the children,
  // so React reuses the existing DOM nodes — only the animation restarts.
  return (
    <div className="page-transition" data-tick={tick}>
      {children}
    </div>
  );
}
