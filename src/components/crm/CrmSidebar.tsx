import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  Crown,
  Dumbbell,
  GraduationCap,
  Bot,
  HelpCircle,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { getTemplate } from "@/lib/industry-templates";

import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/hooks/use-theme";
import { useSubscription } from "@/hooks/useSubscription";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; icon: LucideIcon; label: string };
type NavSection = { label: string; items: NavItem[] };

function planLabel(productId: string | undefined, isManual: boolean): string {
  if (isManual) return "Lifetime";
  if (!productId) return "Active";
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
  const { isAdmin: isPlatformAdmin } = usePlatformAdmin();
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

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.body.style.overflow;
    if (mobileOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileOpen]);

  // Industry-specific nav is gated STRICTLY on the active template key.
  // Previously we OR'd against `enabled_modules.includes(...)` which caused
  // cross-template bleed: if an org switched from Energy → Solar, leftover
  // module keys in the DB would keep the Energy hub visible in the sidebar.
  // The template key is the single source of truth.
  const industryItems: NavItem[] = [
    ...(template.key === "energy"
      ? [
          { to: "/energy", icon: Zap, label: "Energy Hub" },
          { to: "/energy/loa", icon: FileText, label: "LOAs" },
          { to: "/energy/usage", icon: Gauge, label: "Usage" },
          { to: "/energy/pricing", icon: DollarSign, label: "Pricing" },
          { to: "/energy/contracts", icon: FileSignature, label: "Contracts" },
          { to: "/energy/suppliers", icon: Building2, label: "Suppliers" },
          { to: "/energy/renewals", icon: RefreshCw, label: "Renewals" },
        ]
      : []),
    ...(template.key === "solar"
      ? [
          { to: "/solar", icon: SunIcon, label: "Solar Hub" },
          { to: "/solar/projects", icon: FileSignature, label: "Projects" },
        ]
      : []),
    ...(template.key === "real_estate"
      ? [
          { to: "/real-estate", icon: Home, label: "Real Estate Hub" },
          { to: "/real-estate/listings", icon: FileText, label: "Listings" },
          { to: "/real-estate/showings", icon: CalendarDays, label: "Showings" },
        ]
      : []),
    ...(template.key === "insurance"
      ? [
          { to: "/insurance", icon: Shield, label: "Insurance Hub" },
          { to: "/insurance/quotes", icon: FileText, label: "Quotes" },
          { to: "/insurance/policies", icon: FileSignature, label: "Policies" },
        ]
      : []),
    ...(template.key === "gym"
      ? [{ to: "/gym", icon: Dumbbell, label: "Member Health" }]
      : []),
  ];

  // Suppress unused-warning — kept on the auth context for future opt-in modules.
  void enabledModules;


  const sections: NavSection[] = [
    {
      label: "Overview",
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { to: "/leads", icon: Users, label: template.terminology.leadPlural },
        ...(industryItems.length ? industryItems : []),
      ],
    },
    {
      label: "Engage",
      items: [
        { to: "/conversations", icon: Inbox, label: "Conversations" },
        { to: "/messages", icon: MessageSquare, label: "Messages" },
        { to: "/email-marketing", icon: Mail, label: "Email Marketing" },
        { to: "/contact-submissions", icon: Inbox, label: "Contact Inbox" },
        { to: "/followup-inbox", icon: Bot, label: "AI Follow-ups" },
      ],
    },
    {
      label: "Automate",
      items: [
        { to: "/command-chat", icon: Sparkles, label: "Command Chat" },
        { to: "/advisor", icon: Sparkles, label: "AI Advisor" },
        { to: "/campaigns", icon: Zap, label: "Campaigns" },
        { to: "/sequences", icon: Send, label: "Sequences" },
        { to: "/workflows", icon: GitBranch, label: "Workflows" },
        { to: "/funnels", icon: Globe, label: "Sites & Funnels" },
      ],
    },
    {
      label: "Schedule",
      items: [
        { to: "/calendar", icon: CalendarDays, label: "Calendar" },
        { to: "/appointments", icon: CalendarCheck, label: "Appointments" },
      ],
    },
    {
      label: "Revenue",
      items: [
        { to: "/revenue", icon: TrendingUp, label: "Revenue" },
        { to: "/payouts", icon: Wallet, label: "Payouts" },
        { to: "/expenses", icon: Receipt, label: "Expenses" },
        { to: "/invoices", icon: FileText, label: "Invoices" },
      ],
    },
    {
      label: "Insight",
      items: [
        { to: "/analytics", icon: BarChart3, label: "Analytics" },
        { to: "/reputation", icon: Star, label: "Reputation" },
      ],
    },
    {
      label: "Workspace",
      items: [
        { to: "/academy", icon: GraduationCap, label: "Academy" },
        { to: "/billing", icon: CreditCard, label: "Billing" },
        ...(isReseller && isOwner
          ? [{ to: "/clients", icon: Building2, label: "Clients" }]
          : []),
        ...(isPlatformAdmin
          ? [{ to: "/admin", icon: Crown, label: "Platform Admin" }]
          : []),
      ],
    },
  ];

  const isManual = subscription?.environment === "manual";
  const planName = planLabel(subscription?.price_id, isManual);
  const initials = (profile?.full_name || user?.email || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";

  const renderNavLink = (item: NavItem) => {
    const isActive = location.pathname === item.to;
    const tourId = `nav-${item.to.replace(/^\//, "").replace(/\//g, "-")}`;
    return (
      <Link
        key={item.to}
        to={item.to as string}
        data-tour={tourId}
        onClick={() => setMobileOpen(false)}
        aria-current={isActive ? "page" : undefined}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-out hover:translate-x-0.5 ${
          isActive
            ? "bg-sidebar-accent text-sidebar-primary-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        }`}
      >
        {/* Active indicator bar */}
        <span
          aria-hidden
          className={`absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-all duration-300 ease-out ${
            isActive ? "w-1 opacity-100" : "w-0 opacity-0"
          }`}
        />
        <item.icon
          className={`h-4 w-4 shrink-0 transition-all duration-200 ease-out group-hover:scale-110 ${
            isActive
              ? "scale-110 text-sidebar-primary"
              : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
          }`}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between gap-3 border-b border-sidebar-border px-5">
        <Link
          to="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex min-w-0 items-center gap-3"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-8 w-8 shrink-0 rounded-lg object-contain" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-base font-extrabold text-primary-foreground shadow-[0_0_18px_-4px_var(--color-primary)] transition-shadow duration-300 hover:shadow-[0_0_28px_-4px_var(--color-primary)]">
              {brandName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-lg font-bold text-gradient-primary">{brandName}</span>
        </Link>
        <button
          aria-label="Close menu"
          className="rounded-md p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* User info */}
      {profile && (
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {profile.full_name || "User"}
            </p>
            <p className="truncate text-xs capitalize text-sidebar-foreground/60">
              {role?.role?.replace("_", " ") || "Member"}
            </p>
          </div>
        </div>
      )}

      {/* Navigation — grouped sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section, idx) => {
          if (section.items.length === 0) return null;
          return (
            <div key={section.label} className={idx > 0 ? "mt-4" : ""}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {section.label}
              </p>
              <div className="space-y-0.5">{section.items.map(renderNavLink)}</div>
            </div>
          );
        })}
      </nav>

      {/* Plan badge + footer actions */}
      <div className="space-y-1 border-t border-sidebar-border p-3">
        {subscription ? (
          <Link
            to="/billing"
            search={{ required: undefined, plan: undefined }}
            className="flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 transition-colors hover:bg-sidebar-accent"
            onClick={() => setMobileOpen(false)}
          >
            <span className="text-xs text-sidebar-foreground/70">Current plan</span>
            <Badge
              variant={isManual ? "warning" : "default"}
              className="text-[10px] uppercase tracking-wide"
            >
              {planName}
            </Badge>
          </Link>
        ) : (
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
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <Link
          to="/billing"
          search={{ required: undefined, plan: undefined }}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <ArrowUpCircle className="h-4 w-4" />
          <span className="flex-1">Upgrade plan</span>
          {!subscription && (
            <span aria-label="Upgrade available" className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </Link>
        <Link
          to={"/settings" as string}
          data-tour="nav-settings"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <button
          onClick={() => {
            setMobileOpen(false);
            window.dispatchEvent(new Event("genesis:restart-tour"));
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <HelpCircle className="h-4 w-4" />
          Restart tour
        </button>
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:hidden">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-6 w-6 rounded object-contain" />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-xs font-extrabold text-primary-foreground">
              {brandName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm font-bold text-gradient-primary">{brandName}</span>
        </Link>
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
            className="absolute inset-0 bg-background/70 backdrop-blur-sm animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full shadow-2xl animate-in slide-in-from-left">
            {sidebar}
          </div>
        </div>
      )}
    </>
  );
}
