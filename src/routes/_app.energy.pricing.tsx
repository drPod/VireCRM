import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";
import { IndustryGate } from "@/components/crm/IndustryGate";

const config: EnergyTableConfig = {
  table: "pricing_requests",
  title: "Pricing Requests",
  description:
    "Multi-supplier pricing requests. Compare quotes side-by-side before sending a proposal.",
  statusOptions: ["pending", "received", "proposal_sent", "won", "lost"],
  columns: [
    { key: "utility", label: "Utility" },
    { key: "zone", label: "Zone" },
    { key: "target_rate", label: "Target Rate" },
    { key: "urgency", label: "Urgency" },
    { key: "status", label: "Status", status: true },
    {
      key: "created_at",
      label: "Created",
      render: (r) => new Date(String(r.created_at)).toLocaleDateString(),
    },
  ],
  createFields: [
    { key: "utility", label: "Utility", required: true, placeholder: "Oncor" },
    { key: "zone", label: "Zone", placeholder: "North, Houston, …" },
    { key: "start_date", label: "Desired start date", type: "date" },
    { key: "target_rate", label: "Target rate ($/kWh)", type: "number", placeholder: "0.0789" },
    { key: "urgency", label: "Urgency", placeholder: "low / normal / high" },
  ],
  defaults: { status: "pending" },
};

export const Route = createFileRoute("/_app/energy/pricing")({
  component: () => (
    <IndustryGate industry="energy">
      <EnergyTablePage config={config} />
    </IndustryGate>
  ),
  head: () => ({
    meta: [{ title: "Energy Pricing — VireCRM" }],
  }),
});
