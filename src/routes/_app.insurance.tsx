import { createFileRoute } from "@tanstack/react-router";
import { IndustryHub } from "./_app.solar";
import { IndustryGate } from "@/components/crm/IndustryGate";

export const Route = createFileRoute("/_app/insurance")({
  component: () => (
    <IndustryGate industry="insurance">
      <IndustryHub industry="insurance" />
    </IndustryGate>
  ),
});
