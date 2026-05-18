import {
  BarChart3,
  CalendarDays,
  CreditCard,
  GitBranch,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Receipt,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "leads", icon: Users, label: "Leads" },
  { id: "messages", icon: MessageSquare, label: "Messages" },
  { id: "campaigns", icon: Zap, label: "Campaigns" },
  { id: "workflows", icon: GitBranch, label: "Workflows" },
  { id: "calendar", icon: CalendarDays, label: "Calendar" },
  { id: "email", icon: Mail, label: "Email Marketing" },
  { id: "revenue", icon: TrendingUp, label: "Revenue" },
  { id: "payouts", icon: Wallet, label: "Payouts" },
  { id: "expenses", icon: Receipt, label: "Expenses" },
  { id: "reputation", icon: Star, label: "Reputation" },
  { id: "advisor", icon: Sparkles, label: "AI Advisor" },
  { id: "analytics", icon: BarChart3, label: "Analytics" },
  { id: "billing", icon: CreditCard, label: "Billing" },
];

export const VALID_VIEWS = new Set(NAV_ITEMS.map((n) => n.id));

export function labelFor(id: string): string {
  return NAV_ITEMS.find((n) => n.id === id)?.label || "Dashboard";
}
