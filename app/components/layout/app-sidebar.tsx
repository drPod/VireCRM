import {
  Briefcase,
  FileSignature,
  Gauge,
  Handshake,
  MapPin,
  Receipt,
  Split,
  Users,
  UsersRound,
  Zap,
} from "lucide-react";
import { NavLink } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";

/**
 * Primary navigation. Links cover every domain table that has a route stub
 * scaffolded — keep this list in sync with `app/routes.ts` and the 9 domain
 * tables in `docs/decisions/06-domain-schema.md`.
 */
type NavItem = {
  to: string;
  label: string;
  icon: typeof Gauge;
  end?: boolean;
};

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: "/", label: "Dashboard", icon: Gauge, end: true },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/service-addresses", label: "Service Addresses", icon: MapPin },
  { to: "/esis", label: "ESIs", icon: Zap },
  { to: "/contracts", label: "Contracts", icon: FileSignature },
  { to: "/deals", label: "Deals", icon: Handshake },
  { to: "/agents", label: "Agents", icon: UsersRound },
  { to: "/loas", label: "LOAs", icon: Briefcase },
  { to: "/commission-statements", label: "Commission Statements", icon: Receipt },
  { to: "/aggregator-payouts", label: "Aggregator Payouts", icon: Split },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Zap className="size-5 text-primary" aria-hidden />
          <span className="font-semibold tracking-tight">genesisxsx</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pipeline</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <SidebarMenuItem key={to}>
                  <NavLink to={to} end={end} className="contents">
                    {({ isActive }) => (
                      <SidebarMenuButton isActive={isActive} tooltip={label}>
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
