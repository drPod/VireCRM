import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";
import {
  ArrowRight,
  Bell,
  EyeOff,
  Lock,
  PlayCircle,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  isAllowed,
  shouldBlockClickEvent,
  shouldBlockKeyboardEvent,
} from "@/lib/preview/read-only-shield";
import { GuidedTour, type TourStep } from "@/components/preview/GuidedTour";
import { NAV_ITEMS, VALID_VIEWS, labelFor } from "@/components/preview/nav";
import { PreviewViewBanner } from "@/components/preview/PreviewViewBanner";
import { AdvisorView } from "@/components/preview/views/AdvisorView";
import { AnalyticsView } from "@/components/preview/views/AnalyticsView";
import { CalendarView } from "@/components/preview/views/CalendarView";
import { CampaignsView } from "@/components/preview/views/CampaignsView";
import { DashboardView } from "@/components/preview/views/DashboardView";
import { EmailMarketingView } from "@/components/preview/views/EmailMarketingView";
import { LeadsView } from "@/components/preview/views/LeadsView";
import { MessagesView } from "@/components/preview/views/MessagesView";
import { PlaceholderView } from "@/components/preview/views/PlaceholderView";
import { ReputationView } from "@/components/preview/views/ReputationView";
import { RevenueView } from "@/components/preview/views/RevenueView";
import { WorkflowsView } from "@/components/preview/views/WorkflowsView";

interface PreviewSearch {
  view?: string;
}

export const Route = createFileRoute("/preview")({
  component: CrmPreviewPage,
  validateSearch: (s: Record<string, unknown>): PreviewSearch => {
    if (typeof s.view !== "string") return {};
    if (!VALID_VIEWS.has(s.view)) return {};
    if (s.view === "dashboard") return {};
    return { view: s.view };
  },
  head: () => ({
    meta: [
      { title: "Preview the CRM — Majix" },
      {
        name: "description",
        content:
          "Take a free interactive tour of the Majix AI CRM dashboard, leads pipeline, and automation tools — no signup required.",
      },
      { property: "og:title", content: "Preview the Majix CRM — no signup" },
      {
        property: "og:description",
        content:
          "Explore a live, interactive preview of the Majix AI CRM. See the dashboard, pipeline, and AI assistant in action.",
      },
    ],
  }),
});

function ViewRenderer({ view }: { view: string }) {
  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "leads":
      return <LeadsView />;
    case "messages":
      return <MessagesView />;
    case "campaigns":
      return <CampaignsView />;
    case "workflows":
      return <WorkflowsView />;
    case "calendar":
      return <CalendarView />;
    case "email":
      return <EmailMarketingView />;
    case "revenue":
      return <RevenueView />;
    case "reputation":
      return <ReputationView />;
    case "advisor":
      return <AdvisorView />;
    case "analytics":
      return <AnalyticsView />;
    default:
      return <PlaceholderView label={labelFor(view)} />;
  }
}

const TOUR_STEPS: TourStep[] = [
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
    body: "Majix ranks every opportunity by intent and value, so your reps always know what to chase next.",
  },
  {
    tab: "leads",
    selector: '[data-tour="leads-table"]',
    title: "Every lead, every signal",
    body: "Filter by status, search by company, see AI scores and last touch — your whole pipeline in one view.",
  },
  {
    tab: "messages",
    selector: '[data-tour="messages"]',
    title: "Unified messages inbox",
    body: "Email, SMS, WhatsApp and Instagram replies land in one timeline. The AI drafts responses you can send in a click.",
  },
  {
    tab: "workflows",
    selector: '[data-tour="workflows"]',
    title: "Automate the whole funnel",
    body: "Build multi-channel sequences with branches, waits, and AI-personalized copy. Auto-paused on reply.",
  },
  {
    tab: "advisor",
    selector: '[data-tour="advisor"]',
    title: "Majix AI Advisor",
    body: "Ask anything about your pipeline — Majix surfaces hot leads, suggests next actions, and writes outreach for you.",
  },
  {
    tab: "calendar",
    selector: '[data-tour="calendar"]',
    title: "Bookings, no chasing",
    body: "Round-robin scheduling, automated reminders, and a self-serve link your leads can book on instantly.",
  },
  {
    tab: "revenue",
    selector: '[data-tour="revenue"]',
    title: "Revenue you can defend",
    body: "Live MRR, LTV, CAC, and an AI forecast with low / likely / high ranges — exportable for board decks.",
  },
  {
    tab: "email",
    selector: '[data-tour="email"]',
    title: "Email Marketing",
    body: "Design and send email campaigns to your leads. Templates, scheduling, and open-rate tracking all in one place.",
  },
  {
    tab: "campaigns",
    selector: '[data-tour="campaigns"]',
    title: "Campaigns",
    body: "Run multi-channel outreach campaigns. Combine email, SMS, and AI-powered follow-ups in a single campaign flow.",
  },
  {
    tab: "analytics",
    selector: '[data-tour="analytics"]',
    title: "Analytics",
    body: "Track pipeline performance, conversion rates, and team activity. Identify bottlenecks and top performers at a glance.",
  },
  {
    tab: "reputation",
    selector: '[data-tour="reputation"]',
    title: "Reputation Management",
    body: "Monitor and respond to reviews across Google, Facebook, and other platforms — all from one inbox.",
  },
];

function CrmPreviewPage() {
  const search = Route.useSearch();
  const active = search.view ?? "dashboard";
  const navigate = useNavigate({ from: Route.fullPath });
  const lastToastAt = useRef(0);
  const [tourStep, setTourStep] = useState<number | null>(null);

  const setActive = useCallback(
    (id: string) => {
      navigate({
        search: id === "dashboard" ? {} : { view: id },
        replace: true,
      });
    },
    [navigate],
  );

  const startTour = useCallback(() => {
    setActive("dashboard");
    setTourStep(0);
  }, [setActive]);
  const endTour = useCallback(() => setTourStep(null), []);

  const goToStep = useCallback(
    (idx: number) => {
      const step = TOUR_STEPS[idx];
      if (!step) return;
      if (step.tab !== active) setActive(step.tab);
      setTourStep(idx);
    },
    [active, setActive],
  );

  const notifyBlocked = useCallback(() => {
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
      if (!shouldBlockClickEvent(e.target)) return;
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

  const handleKeyDownCapture = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!shouldBlockKeyboardEvent(e.key, e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      notifyBlocked();
    },
    [notifyBlocked],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
            <Button asChild variant="ghost" size="sm" data-preview-allow="true">
              <Link to="/" data-preview-allow="true">
                Exit preview
              </Link>
            </Button>
            <Button
              asChild
              variant="command"
              size="sm"
              className="gap-1.5"
              data-preview-allow="true"
            >
              <Link to="/signup" data-preview-allow="true" className="inline-flex items-center gap-1.5">
                Start free trial
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div
        className="flex flex-1 overflow-hidden"
        onClickCapture={handleClickCapture}
        onSubmitCapture={handleSubmitCapture}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-lg font-extrabold text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]">
              G
            </span>
            <span className="text-lg font-bold text-gradient-primary">Majix</span>
          </div>

          <div className="border-b border-sidebar-border px-6 py-3">
            <p className="text-sm font-medium text-sidebar-foreground">Demo Workspace</p>
            <p className="text-xs text-muted-foreground">Owner · Preview</p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {NAV_ITEMS.map((item) => {
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-preview-allow="true"
                  onClick={() => setActive(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${
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
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-disabled="true"
                    disabled
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground/70 disabled:cursor-not-allowed"
                  >
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    Settings
                    <Lock className="ml-auto h-3 w-3 opacity-60" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Sign up to manage real workspace settings.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground capitalize">{labelFor(active)}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground md:flex">
                <Search className="h-3.5 w-3.5" />
                <span>Search…</span>
                <kbd className="rounded border border-border bg-background px-1.5 text-xs">⌘K</kbd>
              </div>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="relative cursor-not-allowed opacity-70"
                      aria-label="Notifications (read-only preview)"
                      aria-disabled="true"
                      disabled
                    >
                      <Bell className="h-4 w-4" aria-hidden="true" />
                      <span
                        aria-hidden="true"
                        className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Notifications activate in a real workspace.</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="command"
                      size="sm"
                      className="gap-1.5 cursor-not-allowed opacity-70"
                      aria-disabled="true"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">New Lead</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Sign up to create leads in your own workspace.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="space-y-6 p-4 sm:p-6">
            <PreviewViewBanner viewId={active} label={labelFor(active)} />
            <ViewRenderer view={active} />
          </div>
        </main>
      </div>

      <GuidedTour
        steps={TOUR_STEPS}
        currentStep={tourStep}
        onNavigate={goToStep}
        onClose={endTour}
      />
    </div>
  );
}
