import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";

const config: EnergyTableConfig = {
  table: "loa_requests",
  title: "LOA Requests",
  description:
    "Letter of Authorization requests sent to prospects to authorize utility data access.",
  statusOptions: ["draft", "sent", "signed", "expired", "cancelled"],
  columns: [
    { key: "customer_legal_name", label: "Customer" },
    { key: "contact_email", label: "Email" },
    { key: "service_address", label: "Service Address" },
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
    {
      key: "contact_email",
      label: "Contact email",
      type: "email",
      placeholder: "billing@acme.com",
    },
    { key: "contact_phone", label: "Contact phone", type: "tel", placeholder: "555-555-1212" },
    { key: "service_address", label: "Service address", placeholder: "123 Main St, Dallas, TX" },
    { key: "esi_id", label: "ESI / Account ID", placeholder: "Optional utility ID" },
  ],
  defaults: { status: "draft" },
};

export const Route = createFileRoute("/_app/energy/loa")({
  component: () => <EnergyTablePage config={config} />,
});
