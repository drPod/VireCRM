import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect } from "react";
import { applyWhiteLabelColor } from "@/lib/white-label-theme";

/**
 * Applies dynamic white-label theming based on the org's primary_color.
 * Maps the brand color into all primary design tokens (primary, ring,
 * sidebar-primary, chart-1) so the entire CRM picks up the owner's brand.
 */
export function WhiteLabelTheme() {
  const { organization } = useAuth();

  useEffect(() => {
    return applyWhiteLabelColor(organization?.primary_color);
  }, [organization?.primary_color]);

  return null;
}
