import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";

const config: EnergyTableConfig = {
  table: "renewals",
  title: "Renewals",
  description: "Upcoming contract renewals. Reach out 90–120 days before expiration to lock in pricing.",
  statusOptions: ["upcoming", "in_progress", "won", "lost"],
  columns: [
    { key: "current_supplier", label: "Current Supplier" },
    { key: "current_rate", label: "Current Rate" },
    {
      key: "contract_end_date",
      label: "Expires",
      render: (r) =>
        r.contract_end_date ? new Date(String(r.contract_end_date)).toLocaleDateString() : "—",
    },
    { key: "status", label: "Status", status: true },
  ],
  createFields: [
    { key: "current_supplier", label: "Current supplier", required: true },
    { key: "current_rate", label: "Current rate ($/kWh)", type: "number" },
    { key: "contract_end_date", label: "Contract end date", type: "date", required: true },
    { key: "renewal_window_start", label: "Renewal window opens", type: "date" },
    { key: "notes", label: "Notes" },
  ],
  defaults: { status: "upcoming" },
};

export const Route = createFileRoute("/_app/energy/renewals")({
  component: () => <EnergyTablePage config={config} />,
});
