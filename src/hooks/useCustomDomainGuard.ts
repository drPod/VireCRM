import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDomainBranding } from "@/components/auth/DomainBrandingProvider";

/**
 * Marketing/legal pages on platform-owned hosts (genesisx, lovable.app, etc.)
 * should NEVER appear under a verified white-label custom domain — that would
 * leak our brand and platform pricing into the reseller's experience.
 *
 * Use this hook on those routes: when the visitor is on a verified custom
 * domain, we silently redirect them back to "/" where DomainBrandingProvider
 * will render the reseller's BrandedSignup instead.
 *
 * Returns `true` while the redirect is being decided so the caller can render
 * a brief loading state and avoid flashing the platform marketing chrome.
 */
export function useCustomDomainGuard(): boolean {
  const { isCustomDomain, loading } = useDomainBranding();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (isCustomDomain) {
      void navigate({ to: "/", replace: true });
    }
  }, [isCustomDomain, loading, navigate]);

  return loading || isCustomDomain;
}
