import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Terminal } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { HeroSection } from "@/components/marketing/HeroSection";
import { TwoWaysSection } from "@/components/marketing/TwoWaysSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { SocialProofSection } from "@/components/marketing/SocialProofSection";
import { CtaSection } from "@/components/marketing/CtaSection";
import { useDomainBranding } from "@/components/auth/DomainBrandingProvider";
import { BrandedSignup } from "@/components/marketing/BrandedSignup";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Genesis — Never Let a Lead Go Cold Again" },
      { name: "description", content: "We build AI-powered CRM systems that respond instantly, follow up relentlessly, and surface your hottest leads — so your team can focus on closing." },
      { property: "og:title", content: "Genesis — Never Let a Lead Go Cold Again" },
      { property: "og:description", content: "AI-powered CRM systems that respond instantly, follow up relentlessly, and put your hottest leads in front of your sales team." },
    ],
  }),
});

async function provisionAfterRedirect(navigate: ReturnType<typeof useNavigate>) {
  const slug = sessionStorage.getItem("reseller_pending_slug");
  const company = sessionStorage.getItem("reseller_pending_company");
  if (!slug || !company) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  try {
    const { data, error } = await supabase.rpc("signup_under_reseller", {
      p_reseller_slug: slug,
      p_company_name: company,
    });
    if (error) throw error;
    const result = data as { success: boolean; error?: string } | null;
    if (!result?.success) throw new Error(result?.error || "Setup failed");
    sessionStorage.removeItem("reseller_pending_slug");
    sessionStorage.removeItem("reseller_pending_company");
    toast.success("Workspace ready!");
    navigate({ to: "/dashboard" });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Setup failed");
  }
}

function LandingPage() {
  const { branding, loading, isCustomDomain } = useDomainBranding();
  const navigate = useNavigate();

  // Handle the post-confirmation/OAuth provision flow
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("provision") === "1") {
      void provisionAfterRedirect(navigate);
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30 animate-soft-pulse">
          <Terminal className="h-7 w-7 text-primary-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">Loading Genesis…</p>
      </div>
    );
  }

  // On a verified reseller custom domain, replace the marketing site
  // with a branded signup form.
  if (isCustomDomain && branding) {
    return <BrandedSignup branding={branding} />;
  }

  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <HeroSection />
      <TwoWaysSection />
      <FeaturesSection />
      <HowItWorksSection />
      <SocialProofSection />
      <CtaSection />
      <MarketingFooter />
    </div>
  );
}
