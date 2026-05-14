import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";

const config: EnergyTableConfig = {
  table: "energy_customers",
  title: "Active Customers",
  description:
    "Customers currently enrolled — track deal details, supplier switches, and contract terms.",
  statusOptions: ["active", "inactive", "churned"],
  columns: [
    { key: "deal_name", label: "Deal" },
    { key: "agent_closed_name", label: "Agent" },
    {
      key: "start_date",
      label: "Start",
      render: (r) => (r.start_date ? new Date(String(r.start_date)).toLocaleDateString() : "—"),
    },
    {
      key: "end_date",
      label: "End",
      render: (r) => (r.end_date ? new Date(String(r.end_date)).toLocaleDateString() : "—"),
    },
    { key: "previous_supplier", label: "Previous Supplier" },
    { key: "current_supplier", label: "Current Supplier" },
    { key: "service_address", label: "Address" },
    { key: "esi_id", label: "ESI #" },
    { key: "annual_kwh", label: "Annual kWh" },
    { key: "term_kwh", label: "Term kWh" },
    { key: "customer_name", label: "Customer" },
    { key: "customer_email", label: "Email" },
    { key: "customer_phone", label: "Phone" },
    { key: "status", label: "Status", status: true },
  ],
  createFields: [
    { key: "deal_name", label: "Deal name", required: true },
    { key: "agent_closed_name", label: "Agent who closed" },
    { key: "start_date", label: "Start date", type: "date" },
    { key: "end_date", label: "End date", type: "date" },
    { key: "previous_supplier", label: "Previous supplier" },
    { key: "current_supplier", label: "Current supplier" },
    { key: "service_address", label: "Service address" },
    { key: "esi_id", label: "ESI number" },
    { key: "annual_kwh", label: "Annual kWh", type: "number" },
    { key: "term_kwh", label: "Term kWh", type: "number" },
    { key: "customer_name", label: "Customer name" },
    { key: "customer_email", label: "Customer email", type: "email" },
    { key: "customer_phone", label: "Customer phone", type: "tel" },
    { key: "notes", label: "Notes" },
  ],
  defaults: { status: "active" },
};

export const Route = createFileRoute("/_app/energy/customers")({
  component: () => <EnergyTablePage config={config} />,
});
