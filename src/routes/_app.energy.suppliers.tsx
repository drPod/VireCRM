import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";
import { IndustryGate } from "@/components/crm/IndustryGate";

const config: EnergyTableConfig = {
  table: "energy_suppliers",
  title: "Energy Suppliers",
  description: "Your roster of suppliers with commission terms, markets served, and contact info.",
  columns: [
    { key: "name", label: "Supplier" },
    { key: "contact_name", label: "Contact" },
    { key: "contact_email", label: "Email" },
    { key: "commission_type", label: "Commission" },
    {
      key: "is_active",
      label: "Active",
      render: (r) => (r.is_active ? "Yes" : "No"),
    },
  ],
  createFields: [
    { key: "name", label: "Supplier name", required: true, placeholder: "TXU Energy" },
    { key: "contact_name", label: "Account manager" },
    { key: "contact_email", label: "Contact email", type: "email" },
    { key: "contact_phone", label: "Contact phone", type: "tel" },
    { key: "submission_email", label: "Contract submission email", type: "email" },
    { key: "payment_terms", label: "Payment terms", placeholder: "Net 30" },
  ],
  defaults: { is_active: true, commission_type: "upfront" },
};

export const Route = createFileRoute("/_app/energy/suppliers")({
  component: () => (
    <IndustryGate industry="energy">
      <EnergyTablePage config={config} />
    </IndustryGate>
  ),
  head: () => ({
    meta: [{ title: "Energy Suppliers — Genesis" }],
  }),
});
