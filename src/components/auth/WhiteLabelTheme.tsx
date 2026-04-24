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
    const org = organization as
      | (typeof organization & {
          secondary_color?: string | null;
          accent_color?: string | null;
          sidebar_color?: string | null;
          button_color?: string | null;
        })
      | null;
    return applyWhiteLabelColor({
      primary: org?.primary_color,
      secondary: org?.secondary_color,
      accent: org?.accent_color,
      sidebar: org?.sidebar_color,
      button: org?.button_color,
    });
  }, [
    organization?.primary_color,
    (organization as { secondary_color?: string | null } | null)?.secondary_color,
    (organization as { accent_color?: string | null } | null)?.accent_color,
    (organization as { sidebar_color?: string | null } | null)?.sidebar_color,
    (organization as { button_color?: string | null } | null)?.button_color,
  ]);

  useEffect(() => {
    return applyFavicon(organization?.favicon_url);
  }, [organization?.favicon_url]);

  useEffect(() => {
    return applyBrandFont(organization?.font_family);
  }, [organization?.font_family]);

  return null;
}
