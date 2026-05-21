import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "VireCRM — Never Let a Lead Go Cold Again" },
      {
        name: "description",
        content:
          "We build AI-powered CRM systems that respond instantly, follow up relentlessly, and surface your hottest leads — so your team can focus on closing.",
      },
      { property: "og:title", content: "VireCRM — Never Let a Lead Go Cold Again" },
      {
        property: "og:description",
        content:
          "AI-powered CRM systems that respond instantly, follow up relentlessly, and put your hottest leads in front of your sales team.",
      },
      { property: "og:url", content: "https://virecrm.com/" },
    ],
    links: [{ rel: "canonical", href: "https://virecrm.com/" }],
  }),
});

function LandingPage() {
  const { loading } = useDomainBranding();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30 animate-soft-pulse">
          <Terminal className="h-7 w-7 text-primary-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">Loading VireCRM…</p>
      </div>
    );
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
