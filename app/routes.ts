import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  layout("routes/app-layout.tsx", [
    index("routes/pipeline.tsx"),
    route("in-pricing", "routes/in-pricing.tsx"),
    route("current-clients", "routes/current-clients.tsx"),
    route("renewals", "routes/renewals.tsx"),
    route("reconciliation", "routes/reconciliation.tsx"),
    route("customers", "routes/customers.tsx"),
    route("customers/:id", "routes/customer-detail.tsx"),
    route("deals", "routes/deals.tsx"),
    route("deals/:id", "routes/deal-detail.tsx"),
    route("contracts", "routes/contracts.tsx"),
    route("contracts/:id", "routes/contract-detail.tsx"),
    route("loas", "routes/loas.tsx"),
  ]),
] satisfies RouteConfig;
