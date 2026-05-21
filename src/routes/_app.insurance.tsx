import { createFileRoute } from "@tanstack/react-router";
import { IndustryHub } from "./_app.solar";
import { IndustryGate } from "@/components/crm/IndustryGate";
import type { IndustryKey } from "@/lib/industry-templates";

export const Route = createFileRoute("/_app/insurance")({
  component: () => (
    // Cast: "insurance" dropped from IndustryKey; route file pending delete.
    <IndustryGate industry={"insurance" as IndustryKey}>
      <IndustryHub industry={"insurance" as IndustryKey} />
    </IndustryGate>
  ),
});
