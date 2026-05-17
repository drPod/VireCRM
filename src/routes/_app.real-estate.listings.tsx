import { createFileRoute } from "@tanstack/react-router";
import { EnergyTablePage, type EnergyTableConfig } from "@/components/energy/EnergyTablePage";
import { IndustryGate } from "@/components/crm/IndustryGate";

const config: EnergyTableConfig = {
  table: "real_estate_listings",
  title: "Listings",
  description: "Active and pending property listings.",
  statusOptions: ["active", "pending", "under_contract", "closed", "withdrawn"],
  columns: [
    { key: "address", label: "Address" },
    { key: "mls_id", label: "MLS" },
    { key: "list_price", label: "Price" },
    { key: "bedrooms", label: "BR" },
    { key: "bathrooms", label: "BA" },
    { key: "status", label: "Status", status: true },
  ],
  createFields: [
    { key: "address", label: "Property address", required: true },
    { key: "mls_id", label: "MLS ID" },
    { key: "list_price", label: "List price", type: "number" },
    { key: "bedrooms", label: "Bedrooms", type: "number" },
    { key: "bathrooms", label: "Bathrooms", type: "number" },
    { key: "square_feet", label: "Square feet", type: "number" },
  ],
  defaults: { status: "active" },
};

export const Route = createFileRoute("/_app/real-estate/listings")({
  component: () => (
    <IndustryGate industry="real_estate">
      <EnergyTablePage config={config} />
    </IndustryGate>
  ),
});
