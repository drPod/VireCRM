import { createFileRoute } from "@tanstack/react-router";
import { Fragment } from "react";
import { useCustomDomainGuard } from "@/hooks/useCustomDomainGuard";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { FeaturesHero } from "@/components/marketing/features/FeaturesHero";
import { FeaturesNav } from "@/components/marketing/features/FeaturesNav";
import { ChapterDivider } from "@/components/marketing/features/ChapterDivider";
import { FeatureBlock } from "@/components/marketing/features/FeatureBlock";
import { ComparisonTable } from "@/components/marketing/features/ComparisonTable";
import { VerticalsStrip } from "@/components/marketing/features/VerticalsStrip";
import { IntegrationsGrid } from "@/components/marketing/features/IntegrationsGrid";
import { FeaturesFaq } from "@/components/marketing/features/FeaturesFaq";
import { CHAPTERS, FEATURES } from "@/components/marketing/features/featureBlocks";

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
  head: () => ({
    meta: [
      { title: "Features — VireCRM" },
      {
        name: "description",
        content:
          "VireCRM is the AI-native CRM your team will actually use — multi-channel inbox, AI lead scoring, command-bar orchestration, booking, analytics, and a first-class white-label tenant layer.",
      },
      {
        property: "og:title",
        content: "VireCRM Features — Sales OS, AI-native, white-label ready",
      },
      {
        property: "og:description",
        content:
          "AI lead scoring, multi-channel inbox, command-center orchestration, booking + calendar, revenue analytics, and white-label resell — one platform.",
      },
      { property: "og:url", content: "https://virecrm.com/features" },
    ],
    links: [{ rel: "canonical", href: "https://virecrm.com/features" }],
  }),
});

const NAV_ITEMS = [
  { id: "capture", label: "Capture" },
  { id: "convert", label: "Convert" },
  { id: "scale", label: "Scale" },
  { id: "compare", label: "Compare" },
  { id: "verticals", label: "Verticals" },
  { id: "integrations", label: "Integrations" },
  { id: "faq", label: "FAQ" },
];

function FeaturesPage() {
  if (useCustomDomainGuard()) return null;
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <FeaturesHero />
      <FeaturesNav items={NAV_ITEMS} />

      {CHAPTERS.map((chapter) => (
        <Fragment key={chapter.id}>
          <ChapterDivider
            id={chapter.id}
            number={chapter.number}
            eyebrow={chapter.eyebrow}
            title={chapter.title}
            subtitle={chapter.subtitle}
          />
          {FEATURES.filter((f) => f.chapter === chapter.id).map((f) => (
            <FeatureBlock
              key={f.id}
              id={f.id}
              eyebrow={f.eyebrow}
              icon={f.icon}
              title={f.title}
              tagline={f.tagline}
              body={f.body}
              bullets={f.bullets}
              mock={f.mock}
              reverse={f.reverse}
            />
          ))}
        </Fragment>
      ))}

      <ComparisonTable />
      <VerticalsStrip />
      <IntegrationsGrid />
      <FeaturesFaq />
      <MarketingFooter />
    </div>
  );
}
