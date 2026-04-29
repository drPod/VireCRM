import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";

const config: EnergyTableConfig = {
  table: "renewals",
  title: "Renewals",
  description: "Upcoming contract renewals. Reach out 90–120 days before expiration to lock in pricing.",
  statusOptions: ["upcoming", "in_progress", "won", "lost"],
  columns: [
    { key: "customer_legal_name", label: "Customer" },
    { key: "current_supplier", label: "Current Supplier" },
    {
      key: "contract_end_date",
      label: "Expires",
      render: (r) =>
        r.contract_end_date ? new Date(String(r.contract_end_date)).toLocaleDateString() : "—",
    },
    { key: "status", label: "Status", status: true },
  ],
  createFields: [
    { key: "customer_legal_name", label: "Customer legal name", required: true },
    { key: "current_supplier", label: "Current supplier" },
    { key: "contract_end_date", label: "Contract end date", type: "date", required: true },
    { key: "annual_kwh", label: "Annual kWh", type: "number" },
  ],
  defaults: { status: "upcoming" },
};

export const Route = createFileRoute("/_app/energy/renewals")({
  component: () => <EnergyTablePage config={config} />,
});
