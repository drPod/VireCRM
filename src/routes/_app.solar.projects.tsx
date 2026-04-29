import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";

const config: EnergyTableConfig = {
  table: "solar_projects",
  title: "Solar Projects",
  description: "Track every homeowner from site survey through PTO.",
  statusOptions: ["site_survey", "design", "proposal_sent", "contract_signed", "permitting", "installed", "pto", "lost"],
  columns: [
    { key: "homeowner_name", label: "Homeowner" },
    { key: "property_address", label: "Address" },
    { key: "utility_company", label: "Utility" },
    { key: "system_size_kw", label: "Size (kW)" },
    { key: "status", label: "Status", status: true },
    { key: "install_date", label: "Install date" },
  ],
  createFields: [
    { key: "homeowner_name", label: "Homeowner name", required: true },
    { key: "property_address", label: "Property address" },
    { key: "utility_company", label: "Utility company" },
    { key: "system_size_kw", label: "System size (kW)", type: "number" },
    { key: "estimated_savings", label: "Estimated annual savings", type: "number" },
    { key: "install_date", label: "Install date", type: "date" },
  ],
  defaults: { status: "site_survey" },
};

export const Route = createFileRoute("/_app/solar/projects")({
  component: () => <EnergyTablePage config={config} />,
});
