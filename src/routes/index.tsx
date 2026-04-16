import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { HeroSection } from "@/components/marketing/HeroSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { SocialProofSection } from "@/components/marketing/SocialProofSection";
import { CtaSection } from "@/components/marketing/CtaSection";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Vireon — Turn Every Lead Into Revenue, Automatically" },
      { name: "description", content: "We build AI-powered CRM systems that follow up, nurture, and close your leads for you—so your business keeps selling even when you're not working." },
      { property: "og:title", content: "Vireon — Turn Every Lead Into Revenue, Automatically" },
      { property: "og:description", content: "AI-powered CRM systems that respond instantly, follow up relentlessly, and convert leads into paying clients on autopilot." },
    ],
  }),
});

function LandingPage() {
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <SocialProofSection />
      <CtaSection />
      <MarketingFooter />
    </div>
  );
}
