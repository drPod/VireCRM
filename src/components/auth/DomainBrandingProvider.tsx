import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyWhiteLabelColor } from "@/lib/white-label-theme";

export interface DomainBranding {
  id: string;
  slug: string;
  brand_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  is_reseller: boolean;
  support_email: string | null;
  verified: boolean;
}

interface DomainBrandingContextValue {
  branding: DomainBranding | null;
  loading: boolean;
  hostname: string | null;
  isCustomDomain: boolean;
}

const DomainBrandingContext = createContext<DomainBrandingContextValue>({
  branding: null,
  loading: true,
  hostname: null,
  isCustomDomain: false,
});

// Hosts that are NEVER treated as a reseller's custom domain
const SYSTEM_HOST_PATTERNS = [
  /\.lovable\.app$/i,
  /\.lovable-project\.com$/i,
  /\.lovableproject\.com$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/i,
  /^vireonx\.space$/i,
  /^www\.vireonx\.space$/i,
];

function isSystemHost(hostname: string): boolean {
  return SYSTEM_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function DomainBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<DomainBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    const host = window.location.hostname;
    setHostname(host);

    if (isSystemHost(host)) {
      setLoading(false);
      return;
    }

    void (async () => {
      const { data, error } = await supabase.rpc("get_org_by_domain", {
        p_hostname: host,
      });
      if (!error && data) {
        setBranding(data as unknown as DomainBranding);
      }
      setLoading(false);
    })();
  }, []);

  // Apply branding CSS variables when domain branding is active
  useEffect(() => {
    return applyWhiteLabelColor(branding?.primary_color);
  }, [branding?.primary_color]);

  // Update document title when domain branding is active
  useEffect(() => {
    if (!branding?.brand_name || typeof document === "undefined") return;
    const original = document.title;
    document.title = branding.brand_name;
    return () => {
      document.title = original;
    };
  }, [branding?.brand_name]);

  const isCustomDomain = !!hostname && !isSystemHost(hostname) && !!branding;

  return (
    <DomainBrandingContext.Provider value={{ branding, loading, hostname, isCustomDomain }}>
      {children}
    </DomainBrandingContext.Provider>
  );
}

export function useDomainBranding() {
  return useContext(DomainBrandingContext);
}
