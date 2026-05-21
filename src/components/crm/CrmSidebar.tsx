import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GettingStartedChecklist } from "@/components/onboarding/GettingStartedChecklist";
import { supabase } from "@/integrations/supabase/client";
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
  Inbox,
  Globe,
  Send,
  FileText,
  Gauge,
  DollarSign,
  FileSignature,
  RefreshCw,
  Crown,
  GraduationCap,
  Bot,
  HelpCircle,
  CalendarCheck,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { getTemplate } from "@/lib/industry-templates";

import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/hooks/use-theme";
import { useSubscription } from "@/hooks/useSubscription";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
};
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

  // Checklist state — columns added by migration 20260521000003. Fetched once
  // per user session; optimistic updates happen inside GettingStartedChecklist.
  // Columns aren't in generated types yet (migration not pushed to remote), so
  // we cast the query result to bypass the type system.
  const [checklistCompleted, setChecklistCompleted] = useState<string[]>([]);
  const [checklistDismissedAt, setChecklistDismissedAt] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      const { data } = await (supabase
        .from("profiles")
        .select("checklist_items_completed, checklist_dismissed_at" as unknown as "*")
        .eq("user_id", user.id)
        .maybeSingle() as unknown as Promise<{ data: Record<string, unknown> | null }>);
      if (cancelled || !data) return;
      setChecklistCompleted(
        Array.isArray(data.checklist_items_completed)
          ? (data.checklist_items_completed as string[])
          : [],
      );
      setChecklistDismissedAt(
        typeof data.checklist_dismissed_at === "string" ? data.checklist_dismissed_at : null,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const brandName = organization?.brand_name || "VireCRM";
  const logoUrl = organization?.logo_url;

  // Industry-aware module list. The owner picks a template in onboarding;
  // we surface industry-specific modules + relabel "Leads" using that
  // template's terminology so the sidebar feels native instead of generic.
  const template = getTemplate(organization?.industry_template);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Allow external callers (e.g. ProductTour) to open/close the drawer
  // programmatically via custom events so tour highlights are visible on mobile.
  useEffect(() => {
    const openHandler = () => setMobileOpen(true);
    const closeHandler = () => setMobileOpen(false);
    window.addEventListener("virecrm:open-sidebar", openHandler);
    window.addEventListener("virecrm:close-sidebar", closeHandler);
    return () => {
      window.removeEventListener("virecrm:open-sidebar", openHandler);
      window.removeEventListener("virecrm:close-sidebar", closeHandler);
    };
  }, []);

  // Lock body scroll when drawer is open. Snapshot the original overflow once
  // on mount — recapturing per render risks stranding `hidden` if another
  // component (Radix Dialog, etc.) toggled overflow between drawer open/close.
  const originalOverflowRef = useRef<string>("");
  useEffect(() => {
    if (typeof document === "undefined") return;
    originalOverflowRef.current = document.body.style.overflow;
    return () => {
      document.body.style.overflow = originalOverflowRef.current;
    };
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileOpen ? "hidden" : originalOverflowRef.current;
  }, [mobileOpen]);

  // Energy is the only vertical. Other Lovable-scaffold verticals (solar /
  // real_estate / insurance / gym) were dropped — they padlocked the energy
  // UI without ever being paid for. Adding a new vertical: widen IndustryKey,
  // append entries here, drop in matching routes.
  const industryItems: NavItem[] = [
    { to: "/energy", icon: Zap, label: "Energy Hub" },
    { to: "/energy/loa", icon: FileText, label: "LOAs" },
    { to: "/energy/usage", icon: Gauge, label: "Usage" },
    { to: "/energy/pricing", icon: DollarSign, label: "Pricing" },
    { to: "/energy/contracts", icon: FileSignature, label: "Contracts" },
    { to: "/energy/suppliers", icon: Building2, label: "Suppliers" },
    { to: "/energy/renewals", icon: RefreshCw, label: "Renewals" },
  ];

  const sections: NavSection[] = [
    {
      label: "Overview",
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { to: "/leads", icon: Users, label: template.terminology.leadPlural },
        { to: "/pipeline", icon: TrendingUp, label: template.terminology.pipeline },
        { to: "/book", icon: Briefcase, label: "Clients" },
      ],
    },
    {
      label: "Verticals",
      items: industryItems,
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
        ...(isPlatformAdmin ? [{ to: "/admin", icon: Crown, label: "Platform Admin" }] : []),
      ],
    },
  ];

  const isManual = subscription?.environment === "manual";
  const planName = planLabel(subscription?.price_id, isManual);
  const initials =
    (profile?.full_name || user?.email || "?")
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
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color,transform] duration-200 ease-out transform-gpu ${
          isActive
            ? "bg-sidebar-accent text-sidebar-primary-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:translate-x-0.5"
        }`}
      >
        {/* Active indicator bar — animate width+opacity only, never `all`. */}
        <span
          aria-hidden
          className={`absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-[width,opacity] duration-300 ease-out ${
            isActive ? "w-1 opacity-100" : "w-0 opacity-0"
          }`}
        />
        <item.icon
          className={`h-4 w-4 shrink-0 transition-[color,transform] duration-200 ease-out group-hover:scale-110 transform-gpu ${
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
            <img
              src={logoUrl}
              alt={brandName}
              className="h-8 w-8 shrink-0 rounded-lg object-contain"
            />
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

      {/* Getting Started checklist — shown until dismissed or all 5 done */}
      {user?.id && checklistDismissedAt === null && (
        <GettingStartedChecklist
          userId={user.id}
          completedItems={checklistCompleted}
          dismissedAt={checklistDismissedAt}
        />
      )}

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
          type="button"
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
          to="/settings"
          data-tour="nav-settings"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            window.dispatchEvent(new Event("virecrm:restart-tour"));
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <HelpCircle className="h-4 w-4" />
          Restart tour
        </button>
        <button
          type="button"
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
            className="absolute inset-0 bg-background/85 animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full shadow-2xl animate-in slide-in-from-left duration-300 ease-out will-change-transform">
            {sidebar}
          </div>
        </div>
      )}
    </>
  );
}
