import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect } from "react";
import {
  applyBrandFont,
  applyFavicon,
  applyWhiteLabelColor,
} from "@/lib/white-label-theme";

/**
 * Applies dynamic white-label theming based on the org's branding fields:
 * primary color, favicon, and font. Maps the brand color into all primary
 * design tokens so the entire CRM picks up the owner's brand.
 */
export function WhiteLabelTheme() {
  const { organization } = useAuth();

  useEffect(() => {
    return applyWhiteLabelColor(organization?.primary_color);
  }, [organization?.primary_color]);

  useEffect(() => {
    return applyFavicon(organization?.favicon_url);
  }, [organization?.favicon_url]);

  useEffect(() => {
    return applyBrandFont(organization?.font_family);
  }, [organization?.font_family]);

  return null;
}
