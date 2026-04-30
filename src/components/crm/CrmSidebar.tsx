import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Zap,
  BarChart3,
  Settings,
  Sparkles,
  Moon,
  Sun,
  LogOut,
  GitBranch,
  CalendarDays,
  Star,
  Mail,
  Receipt,
  Building2,
  CreditCard,
  ArrowUpCircle,
  Menu,
  X,
  TrendingUp,
  Wallet,
  Inbox,
  Globe,
  Send,
  FileText,
  Gauge,
  DollarSign,
  FileSignature,
  RefreshCw,
  Sun as SunIcon,
  Home,
  Shield,
  Dumbbell,
  GraduationCap,
  Bot,
  HelpCircle,
} from "lucide-react";
import { getTemplate } from "@/lib/industry-templates";

import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/hooks/use-theme";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const baseNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/conversations", icon: Inbox, label: "Conversations" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/campaigns", icon: Zap, label: "Campaigns" },
  { to: "/sequences", icon: Send, label: "Sequences" },
  { to: "/workflows", icon: GitBranch, label: "Workflows" },
  { to: "/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/appointments", icon: CalendarDays, label: "Appointments" },
  { to: "/funnels", icon: Globe, label: "Sites & Funnels" },
  { to: "/email-marketing", icon: Mail, label: "Email Marketing" },
  { to: "/revenue", icon: TrendingUp, label: "Revenue" },
  { to: "/payouts", icon: Wallet, label: "Payouts" },
  { to: "/expenses", icon: Receipt, label: "Expenses" },
  { to: "/invoices", icon: Receipt, label: "Invoices" },
  { to: "/reputation", icon: Star, label: "Reputation" },
  { to: "/advisor", icon: Sparkles, label: "AI Advisor" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/billing", icon: CreditCard, label: "Billing" },
];

function planLabel(productId: string | undefined, isManual: boolean): string {
  if (isManual) return "Lifetime";
  if (!productId) return "Active";
  // Map known stripe price/product IDs to friendly names
  const map: Record<string, string> = {
    crm_starter_monthly: "Starter",
    crm_growth_monthly: "Growth",
    crm_pro_monthly: "Pro",
    lease_starter_monthly: "WL — Starter",
    lease_pro_monthly: "WL — Pro",
  };
  return map[productId] || "Active";
}

export function CrmSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { organization, profile, role, signOut, user } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { subscription } = useSubscription(user?.id);
  const [mobileOpen, setMobileOpen] = useState(false);

  const brandName = organization?.brand_name || "Genesis";
  const logoUrl = organization?.logo_url;
  const isReseller = !!(organization as { is_reseller?: boolean } | null)?.is_reseller;
  const isOwner = role?.role === "owner";

  // Industry-aware module list. The owner picks a template in onboarding;
  // we surface industry-specific modules + relabel "Leads" using that
  // template's terminology so the sidebar feels native instead of generic.
  const template = getTemplate(organization?.industry_template);
  const enabledModules = organization?.enabled_modules ?? template.defaultModules;

  const energyNav = enabledModules.includes("energy_loa") || template.key === "energy"
    ? [
        { to: "/energy", icon: Zap, label: "Energy Hub" },
        { to: "/energy/loa", icon: FileText, label: "LOAs" },
        { to: "/energy/usage", icon: Gauge, label: "Usage" },
        { to: "/energy/pricing", icon: DollarSign, label: "Pricing" },
        { to: "/energy/contracts", icon: FileSignature, label: "Contracts" },
        { to: "/energy/suppliers", icon: Building2, label: "Suppliers" },
        { to: "/energy/renewals", icon: RefreshCw, label: "Renewals" },
      ]
    : [];

  const solarNav = template.key === "solar"
    ? [
        { to: "/solar", icon: SunIcon, label: "Solar Hub" },
        { to: "/solar/projects", icon: SunIcon, label: "Projects" },
      ]
    : [];

  const realEstateNav = template.key === "real_estate"
    ? [
        { to: "/real-estate", icon: Home, label: "Real Estate Hub" },
        { to: "/real-estate/listings", icon: Home, label: "Listings" },
        { to: "/real-estate/showings", icon: CalendarDays, label: "Showings" },
      ]
    : [];

  const insuranceNav = template.key === "insurance"
    ? [
        { to: "/insurance", icon: Shield, label: "Insurance Hub" },
        { to: "/insurance/quotes", icon: FileText, label: "Quotes" },
        { to: "/insurance/policies", icon: FileSignature, label: "Policies" },
      ]
    : [];

  const gymNav = template.key === "gym"
    ? [{ to: "/gym", icon: Dumbbell, label: "Member Health" }]
    : [];

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/leads", icon: Users, label: template.terminology.leadPlural },
    ...energyNav,
    ...solarNav,
    ...realEstateNav,
    ...insuranceNav,
    ...gymNav,
    { to: "/command-chat", icon: Sparkles, label: "Command Chat" },
    { to: "/followup-inbox", icon: Bot, label: "AI Follow-ups" },
    { to: "/contact-submissions", icon: Inbox, label: "Contact Inbox" },
    { to: "/academy", icon: GraduationCap, label: "Academy" },
    ...baseNavItems.filter((i) => i.to !== "/dashboard" && i.to !== "/leads"),
    ...(isReseller && isOwner
      ? [{ to: "/clients", icon: Building2, label: "Clients" }]
      : []),
  ];

  const isManual = subscription?.environment === "manual";
  const planName = planLabel(subscription?.price_id, isManual);

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between gap-3 border-b border-sidebar-border px-6">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-lg font-extrabold text-white shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-all duration-300 hover:shadow-[0_0_24px_rgba(168,85,247,0.7)]">
              {brandName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-lg font-bold text-gradient-primary truncate">{brandName}</span>
        </div>
        <button
          aria-label="Close menu"
          className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* User info */}
      {profile && (
        <div className="border-b border-sidebar-border px-6 py-3">
          <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.full_name || "User"}</p>
          <p className="text-xs text-muted-foreground capitalize">{role?.role?.replace("_", " ") || "Member"}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          // data-tour ids are derived from the route so the ProductTour can
          // anchor tooltips to specific sidebar items (e.g. nav-dashboard).
          const tourId = `nav-${item.to.replace(/^\//, "").replace(/\//g, "-")}`;
          return (
            <Link
              key={item.to}
              to={item.to as string}
              data-tour={tourId}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Plan badge + Settings */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        {subscription && (
          <Link
            to="/billing"
            search={{ required: undefined, plan: undefined }}
            className="flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 transition-colors hover:bg-sidebar-accent"
            onClick={() => setMobileOpen(false)}
          >
            <span className="text-xs text-muted-foreground">Current plan</span>
            <Badge
              variant={isManual ? "warning" : "default"}
              className="text-[10px] uppercase tracking-wide"
            >
              {planName}
            </Badge>
          </Link>
        )}
        {!subscription && (
          <Link
            to="/billing"
            search={{ required: undefined, plan: undefined }}
            className="block rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
            onClick={() => setMobileOpen(false)}
          >
            <Sparkles className="mr-1.5 inline h-3 w-3" />
            Choose a plan
          </Link>
        )}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <Link
          to="/billing"
          search={{ required: undefined, plan: undefined }}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <ArrowUpCircle className="h-4 w-4" />
          <span className="flex-1">Upgrade Plan</span>
          {!subscription && (
            <span
              aria-label="Upgrade available"
              className="relative flex h-2 w-2"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </Link>
        <Link
          to={"/settings" as string}
          data-tour="nav-settings"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <button
          onClick={() => {
            setMobileOpen(false);
            window.dispatchEvent(new Event("genesis:restart-tour"));
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          Restart tour
        </button>
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex h-12 items-center justify-between border-b border-border bg-sidebar px-4 lg:hidden">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-6 w-6 rounded object-contain" />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-xs font-extrabold text-white">
              {brandName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-sm font-bold text-gradient-primary">{brandName}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Desktop persistent sidebar */}
      <div className="hidden h-screen lg:block">{sidebar}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">{sidebar}</div>
        </div>
      )}
    </>
  );
}
