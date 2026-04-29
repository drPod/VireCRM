import { createFileRoute } from "@tanstack/react-router";
import { IndustryHub } from "./_app.solar";

export const Route = createFileRoute("/_app/real-estate")({
  component: () => <IndustryHub industry="real_estate" />,
});
