import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("customers", "routes/customers.tsx"),
  route("service-addresses", "routes/service-addresses.tsx"),
  route("esis", "routes/esis.tsx"),
  route("contracts", "routes/contracts.tsx"),
  route("deals", "routes/deals.tsx"),
  route("agents", "routes/agents.tsx"),
  route("loas", "routes/loas.tsx"),
  route("commission-statements", "routes/commission-statements.tsx"),
  route("aggregator-payouts", "routes/aggregator-payouts.tsx"),
] satisfies RouteConfig;
