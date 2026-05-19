import { createFileRoute } from "@tanstack/react-router";
import { AiAdvisorPanel } from "@/components/crm/AiAdvisorPanel";

export const Route = createFileRoute("/_app/advisor")({
  component: AdvisorPage,
  head: () => ({
    meta: [
      { title: "VireCRM — Strategic Advisor" },
      { name: "description", content: "AI-powered business analysis and lead generation strategy" },
    ],
  }),
});

function AdvisorPage() {
  return (
    <div className="p-6">
      <AiAdvisorPanel />
    </div>
  );
}
