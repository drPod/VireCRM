import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";

const config: EnergyTableConfig = {
  table: "contract_requests",
  title: "Contract Requests",
  description: "Contracts in flight: drafted, submitted to supplier, signed, and enrolled.",
  statusOptions: ["draft", "submitted", "signed", "enrolled", "cancelled"],
  columns: [
    { key: "customer_legal_name", label: "Customer" },
    { key: "service_address", label: "Service Address" },
    { key: "term_months", label: "Term (mo)" },
    { key: "final_rate", label: "Rate" },
    { key: "status", label: "Status", status: true },
    {
      key: "created_at",
      label: "Created",
      render: (r) => new Date(String(r.created_at)).toLocaleDateString(),
    },
  ],
  createFields: [
    { key: "customer_legal_name", label: "Customer legal name", required: true },
    { key: "service_address", label: "Service address" },
    { key: "billing_address", label: "Billing address" },
    { key: "contact_email", label: "Contact email", type: "email" },
    { key: "term_months", label: "Term (months)", type: "number" },
    { key: "final_rate", label: "Final rate ($/kWh)", type: "number", placeholder: "0.0789" },
    { key: "start_date", label: "Start date", type: "date" },
  ],
  defaults: { status: "draft" },
};

export const Route = createFileRoute("/_app/energy/contracts")({
  component: () => <EnergyTablePage config={config} />,
  head: () => ({
    meta: [{ title: "Energy Contracts — Genesis" }],
  }),
});
