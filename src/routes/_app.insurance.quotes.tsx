import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";
import { IndustryGate } from "@/components/crm/IndustryGate";

const config: EnergyTableConfig = {
  table: "insurance_quotes",
  title: "Quotes",
  description: "Quote pipeline before bind. Move quotes through draft → sent → accepted.",
  statusOptions: ["draft", "sent", "accepted", "declined", "expired"],
  columns: [
    { key: "prospect_name", label: "Prospect" },
    { key: "policy_type", label: "Type" },
    { key: "carrier", label: "Carrier" },
    { key: "premium_estimate", label: "Premium" },
    { key: "status", label: "Status", status: true },
  ],
  createFields: [
    { key: "prospect_name", label: "Prospect name", required: true },
    { key: "policy_type", label: "Type", placeholder: "auto / home / life" },
    { key: "carrier", label: "Carrier" },
    { key: "premium_estimate", label: "Premium estimate", type: "number" },
  ],
  defaults: { status: "draft", policy_type: "auto" },
};

export const Route = createFileRoute("/_app/insurance/quotes")({
  component: () => (
    <IndustryGate industry="insurance">
      <EnergyTablePage config={config} />
    </IndustryGate>
  ),
});
