/**
 * ProductTour — lightweight, dependency-free interactive walkthrough that
 * guides brand-new users around the CRM on their first sign-in.
 *
 * Each step targets a DOM element by `data-tour="<id>"`. We:
 *   - find the element, scroll it into view, draw a highlight ring around it
 *   - render a tooltip card with title/body/Next/Skip controls, anchored
 *     near the highlighted element (auto-flips so it never goes off-screen)
 *   - on "Got it!" (final step only), persist `profiles.tour_completed_at` so the tour
 *     never auto-launches again; X/Skip/backdrop dismiss without writing to DB
 *
 * Re-positions on resize/scroll so it stays glued to its target.
 *
 * Runs only in the browser (no SSR usage of window/document at module scope).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORT_EMAIL } from "@/config/support";
import { type IndustryKey } from "@/lib/industry-templates";

// Re-export so callers can import both ProductTour and IndustryKey from this module.
export type { IndustryKey };

export interface TourStep {
  /** data-tour id of the target element. Use "_center" for a centered modal step (no anchor). */
  target: string;
  title: string;
  body: string;
  /** Preferred placement; we'll auto-flip if it doesn't fit. */
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

interface ProductTourProps {
  steps: TourStep[];
  open: boolean;
  /** User id so we can mark the tour completed in profiles. */
  userId: string | null;
  onClose: () => void;
}

const RING_PADDING = 6;
const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 320;
const CARET_SIZE = 8;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function ProductTour({ steps, open, userId, onClose }: ProductTourProps) {
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [elementNotFound, setElementNotFound] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Reset to first step whenever the tour opens.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const total = steps.length;
    const isLast = index === total - 1;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (!isLast) setIndex((i) => Math.min(total - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, index, steps.length, onClose]);

  // Move focus to tooltip on step change.
  useEffect(() => {
    if (open) tooltipRef.current?.focus();
  }, [open, index]);

  // On mobile viewports, open the sidebar drawer so nav targets are in the DOM
  // and visible when the tour runs. Close it again when the tour closes.
  // Capture isMobile at effect run time so the cleanup uses the same value
  // even if the user resizes between tour open and tour close.
  useEffect(() => {
    if (!open) return;
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      window.dispatchEvent(new Event("virecrm:open-sidebar"));
    }
    return () => {
      if (isMobile) {
        window.dispatchEvent(new Event("virecrm:close-sidebar"));
      }
    };
  }, [open]);

  // Reset elementNotFound when step changes.
  useEffect(() => {
    setElementNotFound(false);
  }, [index]);

  // Track viewport size for repositioning.
  useEffect(() => {
    if (!open) return;
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

  const step = steps[index];
  const isCenter = step?.target === "_center" || step?.placement === "center";

  // Resolve the target element for the current step. Uses MutationObserver so
  // it reacts the moment the element mounts rather than burning fixed poll
  // slots. Falls back to centered mode after 3 s if the element never appears.
  useEffect(() => {
    // Reset fallback flag on every step (including center steps).
    setElementNotFound(false);

    if (!open || !step || isCenter) {
      setTarget(null);
      setRect(null);
      setElementNotFound(false);
      return;
    }
    let cancelled = false;

    const tryFind = (): boolean => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        if (!cancelled) {
          setTarget(el);
          setRect(getRect(el));
          setElementNotFound(false);
        }
        return true;
      }
      return false;
    };

    // Try immediately — element may already be in the DOM.
    if (tryFind()) return;

    // Watch for DOM mutations until the element appears.
    const observer = new MutationObserver(() => {
      if (tryFind()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Hard timeout: show centered fallback if the element never mounts.
    const timeout = setTimeout(() => {
      if (cancelled) return;
      observer.disconnect();
      setTarget(null);
      setRect(null);
      setElementNotFound(true);
    }, 3000);

    return () => {
      cancelled = true;
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [open, step, isCenter]);

  // Re-measure on viewport changes & after scroll within any ancestor.
  useLayoutEffect(() => {
    if (!target || isCenter) return;
    const update = () => setRect(getRect(target));
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [target, isCenter, viewport.w, viewport.h]);

  // Writes tour_completed_at to the DB then closes. Call only on intentional
  // completion ("Got it!" on the final step).
  const completeTour = async () => {
    if (userId) {
      await supabase
        .from("profiles")
        .update({ tour_completed_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
    onClose();
  };

  if (!open || !step) return null;
  if (typeof document === "undefined") return null;

  // When the target element couldn't be found, fall back to centered rendering
  // so the tooltip is still visible rather than disappearing entirely.
  const effectiveIsCenter = isCenter || elementNotFound;

  const total = steps.length;
  const isLast = index === total - 1;

  // On narrow viewports cap the tooltip so it doesn't overflow the screen edge.
  // Fall back to TOOLTIP_WIDTH when viewport hasn't been measured yet (w === 0).
  const effectiveTooltipWidth =
    viewport.w > 0 ? Math.min(TOOLTIP_WIDTH, viewport.w - 24) : TOOLTIP_WIDTH;

  // Compute tooltip position based on placement + viewport.
  // `placement` is lifted out so the caret computation can reference it.
  let placement: "top" | "bottom" | "left" | "right" = "right";
  const tooltipStyle: React.CSSProperties = (() => {
    if (effectiveIsCenter || !rect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: effectiveTooltipWidth,
        zIndex: 10001,
      };
    }
    placement = step.placement === "center" ? "right" : (step.placement ?? "right");
    // Auto-flip if it would overflow.
    if (
      placement === "right" &&
      rect.left + rect.width + TOOLTIP_GAP + effectiveTooltipWidth > viewport.w
    ) {
      placement = "left";
    }
    if (placement === "left" && rect.left - TOOLTIP_GAP - effectiveTooltipWidth < 0) {
      placement = "bottom";
    }
    if (placement === "bottom" && rect.top + rect.height + TOOLTIP_GAP + 180 > viewport.h) {
      placement = "top";
    }
    if (placement === "top" && rect.top - TOOLTIP_GAP - 180 < 0) {
      placement = "bottom";
    }

    let top = 0,
      left = 0;
    if (placement === "right") {
      top = rect.top + rect.height / 2 - 90;
      left = rect.left + rect.width + TOOLTIP_GAP;
    } else if (placement === "left") {
      top = rect.top + rect.height / 2 - 90;
      left = rect.left - TOOLTIP_GAP - effectiveTooltipWidth;
    } else if (placement === "bottom") {
      top = rect.top + rect.height + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - effectiveTooltipWidth / 2;
    } else {
      top = rect.top - TOOLTIP_GAP - 180;
      left = rect.left + rect.width / 2 - effectiveTooltipWidth / 2;
    }
    top = clamp(top, 12, viewport.h - 200);
    left = clamp(left, 12, viewport.w - effectiveTooltipWidth - 12);
    return {
      position: "fixed",
      top,
      left,
      width: effectiveTooltipWidth,
      zIndex: 10001,
    };
  })();

  // Caret arrow pointing from the tooltip toward the highlighted element.
  const caretStyle: React.CSSProperties | null = (() => {
    if (effectiveIsCenter || !rect) return null;
    const base: React.CSSProperties = {
      position: "absolute",
      width: 0,
      height: 0,
      pointerEvents: "none",
    };
    if (placement === "right") {
      return {
        ...base,
        left: -CARET_SIZE,
        top: "50%",
        transform: "translateY(-50%)",
        borderTop: `${CARET_SIZE}px solid transparent`,
        borderBottom: `${CARET_SIZE}px solid transparent`,
        borderRight: `${CARET_SIZE}px solid hsl(var(--border))`,
      };
    }
    if (placement === "left") {
      return {
        ...base,
        right: -CARET_SIZE,
        top: "50%",
        transform: "translateY(-50%)",
        borderTop: `${CARET_SIZE}px solid transparent`,
        borderBottom: `${CARET_SIZE}px solid transparent`,
        borderLeft: `${CARET_SIZE}px solid hsl(var(--border))`,
      };
    }
    if (placement === "bottom") {
      return {
        ...base,
        top: -CARET_SIZE,
        left: "50%",
        transform: "translateX(-50%)",
        borderLeft: `${CARET_SIZE}px solid transparent`,
        borderRight: `${CARET_SIZE}px solid transparent`,
        borderBottom: `${CARET_SIZE}px solid hsl(var(--border))`,
      };
    }
    return {
      ...base,
      bottom: -CARET_SIZE,
      left: "50%",
      transform: "translateX(-50%)",
      borderLeft: `${CARET_SIZE}px solid transparent`,
      borderRight: `${CARET_SIZE}px solid transparent`,
      borderTop: `${CARET_SIZE}px solid hsl(var(--border))`,
    };
  })();

  // Highlight ring around the target. The box-shadow paints the full-screen dim
  // so we don't need to fight stacking contexts inside the sidebar.
  const ringStyle: React.CSSProperties | null =
    effectiveIsCenter || !rect
      ? null
      : {
          position: "fixed",
          top: rect.top - RING_PADDING,
          left: rect.left - RING_PADDING,
          width: rect.width + RING_PADDING * 2,
          height: rect.height + RING_PADDING * 2,
          border: "2px solid hsl(var(--primary, 250 90% 65%))",
          borderRadius: 10,
          boxShadow:
            "0 0 0 9999px rgba(0,0,0,0.55), 0 0 24px hsl(var(--primary, 250 90% 65%) / 0.55)",
          pointerEvents: "none",
          zIndex: 10000,
          transition: "all 200ms ease",
        };

  return createPortal(
    <>
      {/* Full-screen dim. For center steps only — when we have a ring, the
          ring's box-shadow already paints the dim overlay. */}
      {effectiveIsCenter && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10000 }}
          onClick={onClose}
        />
      )}
      {ringStyle && <div style={ringStyle} aria-hidden="true" />}

      {/* Live region announces step changes to screen readers. */}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {index + 1} of {total}: {step.title}
      </span>

      <div
        ref={tooltipRef}
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
        tabIndex={-1}
        style={tooltipStyle}
        className="rounded-xl border border-border bg-card p-5 shadow-2xl outline-none"
      >
        {caretStyle && <div style={caretStyle} aria-hidden="true" />}
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 id="tour-title" className="text-sm font-semibold text-foreground">
              {step.title}
            </h3>
            <p id="tour-description" className="mt-1 text-sm text-muted-foreground">
              {step.body}
            </p>
          </div>
          <button
            aria-label="Close tour"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-4 bg-primary"
                    : i < index
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {!isLast && (
              <Button size="sm" variant="ghost" onClick={onClose}>
                Skip
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={() => void completeTour()}>
                Got it!
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground/60">
          ← → navigate · Esc close
        </p>
      </div>
    </>,
    document.body,
  );
}

/** The default tour steps for the CRM. Targets must match `data-tour` ids. */
export const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    target: "_center",
    title: "Welcome to VireCRM 👋",
    body: "Let's take a 60-second tour so you know where everything lives. You can replay it anytime from the sidebar.",
    placement: "center",
  },
  {
    target: "nav-dashboard",
    title: "Dashboard",
    body: "Your command center — pipeline value, today's tasks, and key metrics live here.",
    placement: "right",
  },
  {
    target: "nav-leads",
    title: "Leads",
    body: "All your contacts in one searchable table. Click a row to open the details drawer with notes, messages, and AI scoring.",
    placement: "right",
  },
  {
    target: "nav-conversations",
    title: "Conversations",
    body: "Every inbound and outbound message across email, SMS, and chat — sorted by lead.",
    placement: "right",
  },
  {
    target: "nav-workflows",
    title: "Workflows",
    body: "Drag-and-drop automations. Drop AI agents on the canvas to score leads, classify replies, personalize messages, or book appointments automatically.",
    placement: "right",
  },
  {
    target: "nav-command-chat",
    title: "Command Chat",
    body: 'Type plain English commands like "Run outreach on 200 leads" and the AI plans + executes the work for you.',
    placement: "right",
  },
  {
    target: "nav-followup-inbox",
    title: "AI Follow-ups",
    body: "AI-suggested next replies for every active lead. Approve to send, edit, or skip.",
    placement: "right",
  },
  {
    target: "nav-academy",
    title: "Academy",
    body: "Short courses on getting the most out of the CRM. Great if you're new to sales automation.",
    placement: "right",
  },
  {
    target: "nav-settings",
    title: "Settings",
    body: `Brand, integrations, team members, and billing all live in Settings. Need help? Email ${SUPPORT_EMAIL} anytime.`,
    placement: "right",
  },
  {
    target: "_center",
    title: "You're all set 🎉",
    body: 'That\'s the grand tour. Click "Restart tour" in the sidebar anytime you want to see this again.',
    placement: "center",
  },
];

/**
 * Build tour steps tailored to the tenant's industry template. Each industry
 * gets its own curated middle section that highlights the nav items actually
 * present in their sidebar, using industry-specific terminology. Shared
 * utility steps (Command Chat, AI Follow-ups, Academy, Settings) always appear
 * at the end before the "You're all set" close step.
 */
export function buildTourSteps(industryTemplate: IndustryKey): TourStep[] {
  const welcome = DEFAULT_TOUR_STEPS[0];
  const finish = DEFAULT_TOUR_STEPS[DEFAULT_TOUR_STEPS.length - 1];
  const sharedTargets = ["nav-command-chat", "nav-followup-inbox", "nav-academy", "nav-settings"];
  const shared = DEFAULT_TOUR_STEPS.filter((s) => sharedTargets.includes(s.target));

  const industryMiddle: Record<IndustryKey, TourStep[]> = {
    general: DEFAULT_TOUR_STEPS.slice(1, -1).filter((s) => !sharedTargets.includes(s.target)),
    energy: [
      { target: "nav-dashboard", title: "Dashboard", body: "Your command center — pipeline value, energy contracts in progress, and key metrics.", placement: "right" },
      { target: "nav-leads", title: "Prospects", body: "All your energy prospects in one searchable table. Click a row to see notes, messages, and AI scoring.", placement: "right" },
      { target: "nav-energy", title: "Energy Hub", body: "Manage LOAs, usage data, pricing quotes, and supplier info — all in one place.", placement: "right" },
      { target: "nav-energy-loa", title: "LOA Management", body: "Track Letters of Authority from submission through approval. Filter by status and export for suppliers.", placement: "right" },
      { target: "nav-energy-contracts", title: "Contracts", body: "View active energy contracts, renewal dates, and margin per account.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-workflows")!,
    ],
    solar: [
      { target: "nav-dashboard", title: "Dashboard", body: "Your command center — active solar projects, pipeline value, and key metrics.", placement: "right" },
      { target: "nav-leads", title: "Leads", body: "All your solar prospects. Click a row to see site details, notes, messages, and AI scoring.", placement: "right" },
      { target: "nav-solar", title: "Solar Hub", body: "Manage your full solar operation from one place.", placement: "right" },
      { target: "nav-solar-projects", title: "Projects", body: "Track every solar installation from proposal through commissioning. Status, site data, and financials.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-workflows")!,
    ],
    real_estate: [
      { target: "nav-dashboard", title: "Dashboard", body: "Your command center — active listings, leads in pipeline, and key metrics.", placement: "right" },
      { target: "nav-leads", title: "Leads", body: "All your real estate prospects. Click a row to see property interests, notes, and AI scoring.", placement: "right" },
      { target: "nav-real-estate", title: "Real Estate Hub", body: "Manage listings and showings from one place.", placement: "right" },
      { target: "nav-real-estate-listings", title: "Listings", body: "Track all active and pending listings — price, status, days on market.", placement: "right" },
      { target: "nav-real-estate-showings", title: "Showings", body: "Schedule and track showings across all your listings.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-workflows")!,
    ],
    insurance: [
      { target: "nav-dashboard", title: "Dashboard", body: "Your command center — policies active, renewals due, and key metrics.", placement: "right" },
      { target: "nav-leads", title: "Prospects", body: "All your insurance prospects. Click a row to see coverage interests, notes, and AI scoring.", placement: "right" },
      { target: "nav-insurance", title: "Insurance Hub", body: "Manage quotes and policies from one place.", placement: "right" },
      { target: "nav-insurance-quotes", title: "Quotes", body: "Track all active quotes — coverage type, premium, expiry date.", placement: "right" },
      { target: "nav-insurance-policies", title: "Policies", body: "View all in-force policies, renewal dates, and coverage details.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-workflows")!,
    ],
    gym: [
      { target: "nav-dashboard", title: "Dashboard", body: "Your command center — active members, trial signups in pipeline, and key metrics.", placement: "right" },
      { target: "nav-leads", title: "Prospects", body: "All your gym prospects. Click a row to see membership interests, notes, and AI scoring.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-conversations")!,
      { target: "nav-calendar", title: "Calendar", body: "Manage your schedule, trial sessions, and appointments.", placement: "right" },
      { target: "nav-appointments", title: "Appointments", body: "Book and track individual appointments with leads and members.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-workflows")!,
    ],
  };

  return [welcome, ...industryMiddle[industryTemplate], ...shared, finish];
}
