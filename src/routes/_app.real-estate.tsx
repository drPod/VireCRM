import { createFileRoute } from "@tanstack/react-router";
import { IndustryHub } from "./_app.solar";
import { IndustryGate } from "@/components/crm/IndustryGate";
import type { IndustryKey } from "@/lib/industry-templates";

export const Route = createFileRoute("/_app/real-estate")({
  component: () => (
    // Cast: "real_estate" dropped from IndustryKey; route file pending delete.
    <IndustryGate industry={"real_estate" as IndustryKey}>
      <IndustryHub industry={"real_estate" as IndustryKey} />
    </IndustryGate>
  ),
});
