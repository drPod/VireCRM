import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Zap,
  GitBranch,
  CalendarDays,
  Mail,
  TrendingUp,
  Wallet,
  Receipt,
  Star,
  Sparkles,
  BarChart3,
  CreditCard,
  Settings,
  Search,
  Bell,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Phone,
  CheckCircle2,
  Clock,
  Lock,
  ArrowRight,
  EyeOff,
  PlayCircle,
  X,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * Marker attribute. Any interactive element inside the read-only shield
 * that legitimately needs to work (sidebar tab switch, exit preview,
 * upgrade CTA, etc.) opts in by setting data-preview-allow="true".
 * Everything else is intercepted before it can fire side effects.
 */
const ALLOW_ATTR = "data-preview-allow";

function isAllowed(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(`[${ALLOW_ATTR}="true"]`) !== null;
}



export const Route = createFileRoute("/preview")({
  component: CrmPreviewPage,
  head: () => ({
    meta: [
      { title: "Preview the CRM — Genesis" },
      {
        name: "description",
        content:
          "Take a free interactive tour of the Genesis AI CRM dashboard, leads pipeline, and automation tools — no signup required.",
      },
      { property: "og:title", content: "Preview the Genesis CRM — no signup" },
      {
        property: "og:description",
        content:
          "Explore a live, interactive preview of the Genesis AI CRM. See the dashboard, pipeline, and AI assistant in action.",
      },
    ],
  }),
});

const navItems = [
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

const metrics = [
  {
    label: "Active Leads",
    value: "1,284",
    change: "+12.5%",
    trend: "up" as const,
    icon: Users,
  },
  {
    label: "Pipeline Value",
    value: "$347,920",
    change: "+8.2%",
    trend: "up" as const,
    icon: TrendingUp,
  },
  {
    label: "Closed This Month",
    value: "47",
    change: "+23%",
    trend: "up" as const,
    icon: CheckCircle2,
  },
  {
    label: "Avg Response Time",
    value: "2.4 min",
    change: "-41%",
    trend: "down" as const,
    icon: Clock,
  },
];

const pipelineStages = [
  { name: "New", count: 142, color: "oklch(0.65 0.15 250)" },
  { name: "Contacted", count: 87, color: "oklch(0.65 0.18 280)" },
  { name: "Qualified", count: 54, color: "oklch(0.65 0.18 320)" },
  { name: "Proposal", count: 28, color: "oklch(0.7 0.18 50)" },
  { name: "Won", count: 18, color: "oklch(0.7 0.18 145)" },
];

const sampleLeads = [
  {
    name: "Sarah Chen",
    company: "Apex Logistics",
    status: "Qualified",
    value: "$24,500",
    score: 92,
    initials: "SC",
  },
  {
    name: "Marcus Webb",
    company: "Northwind Energy",
    status: "Proposal",
    value: "$58,000",
    score: 88,
    initials: "MW",
  },
  {
    name: "Priya Patel",
    company: "BlueRiver Tech",
    status: "Contacted",
    value: "$12,300",
    score: 76,
    initials: "PP",
  },
  {
    name: "David Okafor",
    company: "Helix Manufacturing",
    status: "Qualified",
    value: "$41,200",
    score: 84,
    initials: "DO",
  },
  {
    name: "Emma Lindqvist",
    company: "Polaris Retail Group",
    status: "New",
    value: "$8,900",
    score: 68,
    initials: "EL",
  },
];

const activityFeed = [
  {
    icon: Mail,
    text: "AI sent follow-up to Sarah Chen",
    time: "2m ago",
    color: "text-primary",
  },
  {
    icon: Phone,
    text: "Marcus Webb booked a discovery call",
    time: "18m ago",
    color: "text-success",
  },
  {
    icon: CheckCircle2,
    text: "Deal closed: Helix Manufacturing — $41,200",
    time: "1h ago",
    color: "text-success",
  },
  {
    icon: Sparkles,
    text: "AI Advisor identified 12 hot leads",
    time: "3h ago",
    color: "text-primary",
  },
  {
    icon: MessageSquare,
    text: "New reply from Priya Patel",
    time: "5h ago",
    color: "text-foreground",
  },
];

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Won" || status === "Qualified") return "default";
  if (status === "Proposal") return "secondary";
  return "outline";
}

function CrmPreviewPage() {
  const [active, setActive] = useState("dashboard");
  const lastToastAt = useRef(0);
  const [tourStep, setTourStep] = useState<number | null>(null);

  const startTour = useCallback(() => {
    setActive("dashboard");
    setTourStep(0);
  }, []);
  const endTour = useCallback(() => setTourStep(null), []);

  // Tour steps. Each step optionally switches the active sidebar tab so the
  // target element is mounted before we try to spotlight it.
  const tourSteps: TourStep[] = [
    {
      tab: "dashboard",
      selector: '[data-tour="metrics"]',
      title: "Your dashboard at a glance",
      body: "Live metrics — active leads, pipeline value, win rate and AI response time — refresh in real time as your team works.",
    },
    {
      tab: "dashboard",
      selector: '[data-tour="pipeline"]',
      title: "AI-prioritized pipeline",
      body: "Genesis ranks every opportunity by intent and value, so your reps always know what to chase next.",
    },
    {
      tab: "messages",
      selector: '[data-tour="placeholder"]',
      title: "Unified messages inbox",
      body: "Email, SMS and chat replies land in one timeline. The AI drafts responses you can send in a click.",
    },
    {
      tab: "advisor",
      selector: '[data-tour="placeholder"]',
      title: "Genesis AI Advisor",
      body: "Ask anything about your pipeline — Genesis surfaces hot leads, suggests next actions, and writes outreach for you.",
    },
  ];

  const goToStep = useCallback(
    (idx: number) => {
      const step = tourSteps[idx];
      if (!step) return;
      if (step.tab !== active) setActive(step.tab);
      setTourStep(idx);
    },
    [active, tourSteps],
  );

  const notifyBlocked = useCallback(() => {
    // Throttle to one toast per 1.2s so rapid clicks don't spam.
    const now = Date.now();
    if (now - lastToastAt.current < 1200) return;
    lastToastAt.current = now;
    toast("Read-only preview", {
      description: "Sign up to create real leads, send messages, and run automations.",
      action: {
        label: "Start free trial",
        onClick: () => {
          if (typeof window !== "undefined") window.location.href = "/signup";
        },
      },
    });
  }, []);

  const handleClickCapture = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isAllowed(e.target)) return;
      const el = e.target as Element;
      const interactive = el.closest(
        'button, a, [role="button"], [role="link"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], select, [data-preview-block]',
      );
      if (!interactive) return;
      e.preventDefault();
      e.stopPropagation();
      notifyBlocked();
    },
    [notifyBlocked],
  );

  const handleSubmitCapture = useCallback(
    (e: FormEvent<HTMLDivElement>) => {
      if (isAllowed(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      notifyBlocked();
    },
    [notifyBlocked],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top preview banner */}
      <div className="sticky top-0 z-50 border-b border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-[oklch(0.65_0.16_320)]/15 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 px-4 py-2.5 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Live preview</span>
            <Badge
              variant="outline"
              className="gap-1 border-primary/40 bg-primary/10 text-[10px] uppercase tracking-wide text-primary"
            >
              <EyeOff className="h-3 w-3" /> Read-only
            </Badge>
            <span className="hidden text-muted-foreground sm:inline">
              — sample data, no actions are saved.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              data-preview-allow="true"
              onClick={startTour}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Take the tour</span>
              <span className="sm:hidden">Tour</span>
            </Button>
            <Link to="/" data-preview-allow="true">
              <Button variant="ghost" size="sm" data-preview-allow="true">
                Exit preview
              </Button>
            </Link>
            <Link to="/signup" data-preview-allow="true">
              <Button variant="command" size="sm" className="gap-1.5" data-preview-allow="true">
                Start free trial
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Read-only shield: intercepts all click/submit events that aren't opted in */}
      <div
        className="flex flex-1 overflow-hidden"
        onClickCapture={handleClickCapture}
        onSubmitCapture={handleSubmitCapture}
      >
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-lg font-extrabold text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]">
              G
            </span>
            <span className="text-lg font-bold text-gradient-primary">Genesis</span>
          </div>

          <div className="border-b border-sidebar-border px-6 py-3">
            <p className="text-sm font-medium text-sidebar-foreground">Demo Workspace</p>
            <p className="text-xs text-muted-foreground">Owner · Preview</p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-preview-allow="true"
                  onClick={() => setActive(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-3 space-y-1">
            <div className="flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">Current plan</span>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                Preview
              </Badge>
            </div>
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70">
              <Settings className="h-4 w-4" />
              Settings
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          {/* Top bar */}
          <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground capitalize">
                {navItems.find((n) => n.id === active)?.label || "Dashboard"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground md:flex">
                <Search className="h-3.5 w-3.5" />
                <span>Search…</span>
                <kbd className="rounded border border-border bg-background px-1.5 text-xs">⌘K</kbd>
              </div>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications (read-only)">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
              </Button>
              <Button variant="command" size="sm" className="gap-1.5" aria-disabled="true">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Lead</span>
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6 p-4 sm:p-6">
            <PreviewViewBanner viewId={active} label={navItems.find((n) => n.id === active)?.label || "Dashboard"} />
            {active === "dashboard" && <DashboardView />}
            {active !== "dashboard" && <PlaceholderView label={navItems.find((n) => n.id === active)?.label || ""} />}
          </div>
        </main>
      </div>

      <GuidedTour
        steps={tourSteps}
        currentStep={tourStep}
        onNavigate={goToStep}
        onClose={endTour}
      />
    </div>
  );
}

function DashboardView() {
  return (
    <>
      {/* Metrics */}
      <div data-tour="metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 scroll-mt-24">
        {metrics.map((m) => (
          <Card key={m.label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{m.value}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <m.icon className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`mt-3 flex items-center gap-1 text-xs font-medium ${
                m.trend === "up" ? "text-success" : "text-success"
              }`}
            >
              {m.trend === "up" ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {m.change} <span className="text-muted-foreground">vs last month</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Pipeline */}
      <Card data-tour="pipeline" className="p-5 scroll-mt-24">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Pipeline</h3>
            <p className="text-sm text-muted-foreground">329 active opportunities</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> AI prioritized
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {pipelineStages.map((s) => (
            <div
              key={s.name}
              className="rounded-lg border border-border bg-card/50 p-3"
              style={{ borderTopWidth: 3, borderTopColor: s.color }}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {s.name}
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{s.count}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Leads table */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Hot leads</h3>
            <span className="text-xs text-muted-foreground">Top 5 by AI score</span>
          </div>
          <div className="space-y-2">
            {sampleLeads.map((lead) => (
              <div
                key={lead.name}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-[oklch(0.65_0.16_320)]/30 text-xs font-semibold text-foreground">
                    {lead.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <Badge variant={statusBadgeVariant(lead.status)} className="text-[10px]">
                    {lead.status}
                  </Badge>
                  <span className="hidden text-sm font-medium text-foreground sm:inline">
                    {lead.value}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-sm font-semibold text-primary">{lead.score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Activity */}
        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-foreground">Live activity</h3>
          <div className="space-y-3">
            {activityFeed.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-md bg-card p-1.5 ${a.color}`}>
                  <a.icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{a.text}</p>
                  <p className="text-xs text-muted-foreground">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Conversion CTA */}
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-[oklch(0.65_0.16_320)]/10 p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Ready to plug in your real pipeline?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start your free trial and let Genesis chase every lead for you, 24/7.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/pricing" data-preview-allow="true">
              <Button variant="outline" size="lg" data-preview-allow="true">
                See pricing
              </Button>
            </Link>
            <Link to="/signup" data-preview-allow="true">
              <Button variant="command" size="lg" className="gap-2" data-preview-allow="true">
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </>
  );
}

function PlaceholderView({ label }: { label: string }) {
  return (
    <Card data-tour="placeholder" className="flex flex-col items-center justify-center gap-4 p-12 text-center scroll-mt-24">
      <div className="rounded-full bg-primary/10 p-4 text-primary">
        <Lock className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{label} is part of the full CRM</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The interactive preview shows the Dashboard. Sign up for a free trial to unlock {label.toLowerCase()},
          AI automations, and the rest of Genesis.
        </p>
      </div>
      <div className="flex gap-2">
        <Link to="/pricing" data-preview-allow="true">
          <Button variant="outline" data-preview-allow="true">See pricing</Button>
        </Link>
        <Link to="/signup" data-preview-allow="true">
          <Button variant="command" className="gap-2" data-preview-allow="true">
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Guided tour
// ─────────────────────────────────────────────────────────────────────────────

interface TourStep {
  tab: string;
  selector: string;
  title: string;
  body: string;
}

interface TourRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface GuidedTourProps {
  steps: TourStep[];
  currentStep: number | null;
  onNavigate: (idx: number) => void;
  onClose: () => void;
}

const PADDING = 12;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_GAP = 16;

function GuidedTour({ steps, currentStep, onNavigate, onClose }: GuidedTourProps) {
  const [rect, setRect] = useState<TourRect | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const active = currentStep !== null ? steps[currentStep] : null;

  // Measure target whenever step changes or window resizes. Use rAF +
  // small delay so tab-switch DOM updates settle before we read layout.
  useLayoutEffect(() => {
    if (!active || typeof window === "undefined") {
      setRect(null);
      return;
    }

    let raf = 0;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(active.selector);
      if (!el) {
        // Target not mounted yet (tab switch in flight) — try again next frame.
        raf = window.requestAnimationFrame(measure);
        return;
      }
      // Scroll into view, then measure.
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };

    // Wait one frame for any tab-switch render to commit, then measure.
    raf = window.requestAnimationFrame(() => {
      raf = window.requestAnimationFrame(measure);
    });

    const onResize = () => {
      const el = document.querySelector(active.selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active]);

  // Keyboard support: Esc closes, arrows step.
  useEffect(() => {
    if (currentStep === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && currentStep < steps.length - 1)
        onNavigate(currentStep + 1);
      else if (e.key === "ArrowLeft" && currentStep > 0) onNavigate(currentStep - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentStep, steps.length, onNavigate, onClose]);

  if (currentStep === null || !active) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // Compute spotlight rectangle (with padding) and tooltip position.
  // If we don't have a rect yet, render a faded full-screen overlay so the
  // mount isn't jarring, but skip the spotlight cutout.
  const spot = rect
    ? {
        top: Math.max(rect.top - PADDING, 8),
        left: Math.max(rect.left - PADDING, 8),
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;

  // Tooltip placement: prefer below the spotlight, fall back to above.
  let tooltipTop = 0;
  let tooltipLeft = 0;
  if (spot) {
    const spaceBelow = viewport.h - (spot.top + spot.height);
    const spaceAbove = spot.top;
    const placeBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
    tooltipTop = placeBelow
      ? Math.min(spot.top + spot.height + TOOLTIP_GAP, viewport.h - 240)
      : Math.max(spot.top - TOOLTIP_GAP - 220, 16);
    tooltipLeft = Math.max(
      16,
      Math.min(
        spot.left + spot.width / 2 - TOOLTIP_WIDTH / 2,
        viewport.w - TOOLTIP_WIDTH - 16,
      ),
    );
  } else {
    tooltipTop = Math.max(viewport.h / 2 - 120, 16);
    tooltipLeft = Math.max(viewport.w / 2 - TOOLTIP_WIDTH / 2, 16);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Tour step ${currentStep + 1} of ${steps.length}: ${active.title}`}
      data-preview-allow="true"
      className="fixed inset-0 z-[100]"
    >
      {/* SVG mask for spotlight cutout */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <mask id="genesis-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.left}
                y={spot.top}
                width={spot.width}
                height={spot.height}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(5, 8, 22, 0.72)"
          mask="url(#genesis-tour-mask)"
        />
      </svg>

      {/* Click-to-close backdrop (sits below the cutout) */}
      <button
        type="button"
        aria-label="Close tour"
        data-preview-allow="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />

      {/* Spotlight outline */}
      {spot && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary/80 shadow-[0_0_0_4px_rgba(168,85,247,0.18),0_0_36px_rgba(168,85,247,0.45)] transition-all duration-300"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        data-preview-allow="true"
        style={{
          position: "absolute",
          top: tooltipTop,
          left: tooltipLeft,
          width: TOOLTIP_WIDTH,
        }}
        className="rounded-xl border border-primary/30 bg-card/95 p-4 shadow-2xl shadow-primary/30 backdrop-blur-xl"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className="gap-1 border-primary/40 bg-primary/10 text-[10px] uppercase tracking-wide text-primary"
          >
            <Sparkles className="h-3 w-3" /> Tour · {currentStep + 1}/{steps.length}
          </Badge>
          <button
            type="button"
            aria-label="Close tour"
            data-preview-allow="true"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="text-base font-semibold text-foreground">{active.title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{active.body}</p>

        {/* Progress dots */}
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            data-preview-allow="true"
            onClick={onClose}
          >
            Skip
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              data-preview-allow="true"
              disabled={isFirst}
              onClick={() => onNavigate(currentStep - 1)}
            >
              Back
            </Button>
            {isLast ? (
              <Button
                variant="command"
                size="sm"
                className="gap-1.5"
                data-preview-allow="true"
                onClick={onClose}
              >
                Finish
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                variant="command"
                size="sm"
                className="gap-1.5"
                data-preview-allow="true"
                onClick={() => onNavigate(currentStep + 1)}
              >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

