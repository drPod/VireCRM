import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";

const config: EnergyTableConfig = {
  table: "pricing_requests",
  title: "Pricing Requests",
  description: "Multi-supplier pricing requests. Compare quotes side-by-side before sending a proposal.",
  statusOptions: ["pending", "received", "proposal_sent", "won", "lost"],
  columns: [
    { key: "customer_legal_name", label: "Customer" },
    { key: "term_months", label: "Term (mo)" },
    { key: "annual_kwh", label: "Annual kWh" },
    { key: "status", label: "Status", status: true },
    {
      key: "created_at",
      label: "Created",
      render: (r) => new Date(String(r.created_at)).toLocaleDateString(),
    },
  ],
  createFields: [
    { key: "customer_legal_name", label: "Customer legal name", required: true },
    { key: "term_months", label: "Term in months", type: "number", placeholder: "12, 24, 36…" },
    { key: "annual_kwh", label: "Annual kWh", type: "number" },
    { key: "start_date", label: "Desired start date", type: "date" },
  ],
  defaults: { status: "pending" },
};

export const Route = createFileRoute("/_app/energy/pricing")({
  component: () => <EnergyTablePage config={config} />,
});
