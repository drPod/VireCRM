import { createFileRoute } from "@tanstack/react-router";
import { WhiteLabelSettings } from "@/components/crm/WhiteLabelSettings";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "AI CRM — Settings" },
      { name: "description", content: "Organization and white-label settings" },
    ],
  }),
});

function SettingsPage() {
  return (
    <div className="p-6">
      <WhiteLabelSettings />
    </div>
  );
}
