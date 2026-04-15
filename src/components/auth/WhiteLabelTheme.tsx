import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect } from "react";

/**
 * Applies dynamic white-label theming based on the org's primary_color.
 * Sets CSS custom properties on :root so all design tokens update.
 */
export function WhiteLabelTheme() {
  const { organization } = useAuth();

  useEffect(() => {
    if (!organization?.primary_color) return;

    const color = organization.primary_color;
    const root = document.documentElement;

    // Set the primary color as a CSS variable that components can use
    root.style.setProperty("--wl-primary", color);

    // Clean up on unmount
    return () => {
      root.style.removeProperty("--wl-primary");
    };
  }, [organization?.primary_color]);

  return null;
}
