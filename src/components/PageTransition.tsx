import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Wraps page content and re-triggers a fade+slide animation
 * whenever the route pathname changes.
 *
 * Uses the `key` prop to force React to remount the subtree,
 * which restarts the CSS animation defined in styles.css
 * (.page-transition).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
