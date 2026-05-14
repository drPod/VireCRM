import { createFileRoute } from "@tanstack/react-router";
import { useCustomDomainGuard } from "@/hooks/useCustomDomainGuard";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { CtaSection } from "@/components/marketing/CtaSection";

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
  head: () => ({
    meta: [
      { title: "Features — Genesis" },
      {
        name: "description",
        content:
          "Explore Genesis's full feature set: autonomous lead scoring, AI outreach, reply classification, auto scheduling, and white-labeling.",
      },
      { property: "og:title", content: "Genesis Features — Autonomous Sales Automation" },
      {
        property: "og:description",
        content:
          "AI lead scoring, automated outreach, reply classification, meeting booking, and white-label support.",
      },
      { property: "og:url", content: "https://genesisx.space/features" },
    ],
    links: [{ rel: "canonical", href: "https://genesisx.space/features" }],
  }),
});

function FeaturesPage() {
  if (useCustomDomainGuard()) return null;
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <div className="pt-16">
        <FeaturesSection />
        <HowItWorksSection />
      </div>
      <CtaSection />
      <MarketingFooter />
    </div>
  );
}
