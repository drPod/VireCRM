import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";

const config: EnergyTableConfig = {
  table: "usage_requests",
  title: "Usage Requests",
  description: "Requests to pull historical utility usage data for pricing.",
  statusOptions: ["pending", "received", "expired", "cancelled"],
  columns: [
    { key: "customer_legal_name", label: "Customer" },
    { key: "esi_id", label: "ESI ID" },
    { key: "utility", label: "Utility" },
    { key: "status", label: "Status", status: true },
    {
      key: "created_at",
      label: "Created",
      render: (r) => new Date(String(r.created_at)).toLocaleDateString(),
    },
  ],
  createFields: [
    { key: "customer_legal_name", label: "Customer legal name", required: true },
    { key: "esi_id", label: "ESI / Account ID", required: true },
    { key: "utility", label: "Utility", placeholder: "Oncor, CenterPoint, …" },
    { key: "service_address", label: "Service address" },
  ],
  defaults: { status: "pending" },
};

export const Route = createFileRoute("/_app/energy/usage")({
  component: () => <EnergyTablePage config={config} />,
});
