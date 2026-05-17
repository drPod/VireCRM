import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";
import { IndustryGate } from "@/components/crm/IndustryGate";

const config: EnergyTableConfig = {
  table: "real_estate_showings",
  title: "Showings",
  description: "Scheduled property showings tied to leads and listings.",
  statusOptions: ["scheduled", "completed", "no_show", "cancelled"],
  columns: [
    { key: "showing_at", label: "When" },
    { key: "outcome", label: "Outcome" },
    { key: "status", label: "Status", status: true },
    { key: "notes", label: "Notes" },
  ],
  createFields: [
    { key: "showing_at", label: "Showing time", type: "date" },
    { key: "outcome", label: "Outcome (if completed)" },
    { key: "notes", label: "Notes" },
  ],
  defaults: { status: "scheduled" },
};

export const Route = createFileRoute("/_app/real-estate/showings")({
  component: () => (
    <IndustryGate industry="real_estate">
      <EnergyTablePage config={config} />
    </IndustryGate>
  ),
});
