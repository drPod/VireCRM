import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";

const config: EnergyTableConfig = {
  table: "loa_requests",
  title: "LOA Requests",
  description:
    "Letter of Authorization requests sent to prospects to authorize utility data access.",
  statusOptions: ["requested", "sent", "signed", "expired", "cancelled"],
  columns: [
    { key: "customer_legal_name", label: "Customer" },
    { key: "utility", label: "Utility" },
    { key: "service_address", label: "Service Address" },
    { key: "esi_id", label: "ESI / Account ID" },
    { key: "status", label: "Status", status: true },
    {
      key: "created_at",
      label: "Created",
      render: (r) => new Date(String(r.created_at)).toLocaleDateString(),
    },
  ],
  createFields: [
    {
      key: "customer_legal_name",
      label: "Customer legal name",
      required: true,
      placeholder: "Acme Inc.",
    },
    { key: "utility", label: "Utility", placeholder: "Oncor, CenterPoint, …" },
    { key: "service_address", label: "Service address", placeholder: "123 Main St, Dallas, TX" },
    { key: "esi_id", label: "ESI / Account ID", placeholder: "Optional utility ID" },
    { key: "notes", label: "Notes" },
  ],
  defaults: { status: "requested" },
};

export const Route = createFileRoute("/_app/energy/loa")({
  component: () => <EnergyTablePage config={config} />,
  head: () => ({
    meta: [{ title: "Energy LOA Requests — Genesis" }],
  }),
});
