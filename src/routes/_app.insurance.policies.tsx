import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";
import { IndustryGate } from "@/components/crm/IndustryGate";

const config: EnergyTableConfig = {
  table: "insurance_policies",
  title: "Policies",
  description: "Bound policies — track premiums, effective dates, and renewals.",
  statusOptions: ["active", "lapsed", "cancelled", "renewed"],
  columns: [
    { key: "policyholder_name", label: "Policyholder" },
    { key: "policy_number", label: "Policy #" },
    { key: "policy_type", label: "Type" },
    { key: "carrier", label: "Carrier" },
    { key: "premium", label: "Premium" },
    { key: "renewal_date", label: "Renews" },
    { key: "status", label: "Status", status: true },
  ],
  createFields: [
    { key: "policyholder_name", label: "Policyholder name", required: true },
    { key: "policy_number", label: "Policy number" },
    { key: "policy_type", label: "Type", placeholder: "auto / home / life" },
    { key: "carrier", label: "Carrier" },
    { key: "premium", label: "Annual premium", type: "number" },
    { key: "effective_date", label: "Effective date", type: "date" },
    { key: "renewal_date", label: "Renewal date", type: "date" },
  ],
  defaults: { status: "active", policy_type: "auto" },
};

export const Route = createFileRoute("/_app/insurance/policies")({
  component: () => (
    <IndustryGate industry="insurance">
      <EnergyTablePage config={config} />
    </IndustryGate>
  ),
});
