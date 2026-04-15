import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Zap,
  BarChart3,
  Settings,
  Terminal,
  Sparkles,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/hooks/use-theme";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/campaigns", icon: Zap, label: "Campaigns" },
  { to: "/advisor", icon: Sparkles, label: "AI Advisor" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
];

export function CrmSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { organization, profile, role, signOut } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  const brandName = organization?.brand_name || "AI CRM";
  const logoUrl = organization?.logo_url;

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        {logoUrl ? (
          <img src={logoUrl} alt={brandName} className="h-8 w-8 rounded-lg object-contain" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Terminal className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
        <span className="text-lg font-bold text-gradient-primary">{brandName}</span>
      </div>

      {/* User info */}
      {profile && (
        <div className="border-b border-sidebar-border px-6 py-3">
          <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.full_name || "User"}</p>
          <p className="text-xs text-muted-foreground capitalize">{role?.role?.replace("_", " ") || "Member"}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to as string}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Plan badge + Settings */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        {organization && (
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {organization.plan} plan
            </span>
          </div>
        )}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <Link
          to={"/settings" as string}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
