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
      { title: "Vireon — The Autonomous Sales Engine" },
      { name: "description", content: "Type one command. AI scores leads, writes outreach, sends messages, classifies replies, and books meetings — automatically." },
      { property: "og:title", content: "Vireon — Your AI Sales Team That Never Sleeps" },
      { property: "og:description", content: "Fully autonomous CRM that handles lead scoring, outreach, follow-ups, and meeting booking with AI." },
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
