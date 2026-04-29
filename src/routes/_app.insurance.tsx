import { createFileRoute } from "@tanstack/react-router";
import { IndustryHub } from "./_app.solar";

export const Route = createFileRoute("/_app/insurance")({
  component: () => <IndustryHub industry="insurance" />,
});
