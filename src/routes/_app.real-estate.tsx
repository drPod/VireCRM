import { createFileRoute } from "@tanstack/react-router";
import { IndustryHub } from "./_app.solar";
import { IndustryGate } from "@/components/crm/IndustryGate";

export const Route = createFileRoute("/_app/real-estate")({
  component: () => (
    <IndustryGate industry="real_estate">
      <IndustryHub industry="real_estate" />
    </IndustryGate>
  ),
});
