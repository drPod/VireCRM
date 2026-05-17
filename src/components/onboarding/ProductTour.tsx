/**
 * ProductTour — lightweight, dependency-free interactive walkthrough that
 * guides brand-new users around the CRM on their first sign-in.
 *
 * Each step targets a DOM element by `data-tour="<id>"`. We:
 *   - find the element, scroll it into view, draw a highlight ring around it
 *   - render a tooltip card with title/body/Next/Skip controls, anchored
 *     near the highlighted element (auto-flips so it never goes off-screen)
 *   - on Finish/Skip, persist `profiles.tour_completed_at` so the tour never
 *     auto-launches again for that user
 *
 * Re-positions on resize/scroll so it stays glued to its target.
 *
 * Runs only in the browser (no SSR usage of window/document at module scope).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORT_EMAIL } from "@/config/support";

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
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Reset to first step whenever the tour opens.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

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

  // Resolve the target element for the current step. Polls briefly because
  // sidebar items mount slightly after first paint (especially on mobile).
  useEffect(() => {
    if (!open || !step || isCenter) {
      setTarget(null);
      setRect(null);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        // Scroll into view inside whatever scroll container holds it.
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        setTarget(el);
        setRect(getRect(el));
      } else if (attempts < 20) {
        attempts += 1;
        setTimeout(tick, 100);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [open, step, isCenter]);

  // Re-measure on viewport changes & after scroll within any ancestor.
  useLayoutEffect(() => {
    if (!target || isCenter) return;
    const update = () => setRect(getRect(target));
    update();
    const onScroll = () => update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [target, isCenter, viewport.w, viewport.h]);

  const finish = async () => {
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

  const total = steps.length;
  const isLast = index === total - 1;

  // Compute tooltip position based on placement + viewport.
  const tooltipStyle: React.CSSProperties = (() => {
    if (isCenter || !rect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: TOOLTIP_WIDTH,
        zIndex: 10001,
      };
    }
    let placement = step.placement ?? "right";
    // Auto-flip if it would overflow.
    if (
      placement === "right" &&
      rect.left + rect.width + TOOLTIP_GAP + TOOLTIP_WIDTH > viewport.w
    ) {
      placement = "left";
    }
    if (placement === "left" && rect.left - TOOLTIP_GAP - TOOLTIP_WIDTH < 0) {
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
      left = rect.left - TOOLTIP_GAP - TOOLTIP_WIDTH;
    } else if (placement === "bottom") {
      top = rect.top + rect.height + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    } else {
      top = rect.top - TOOLTIP_GAP - 180;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    }
    top = clamp(top, 12, viewport.h - 200);
    left = clamp(left, 12, viewport.w - TOOLTIP_WIDTH - 12);
    return {
      position: "fixed",
      top,
      left,
      width: TOOLTIP_WIDTH,
      zIndex: 10001,
    };
  })();

  // Highlight ring around the target. Built with 4 dim overlays so we don't
  // need to fight stacking contexts inside the sidebar.
  const ringStyle: React.CSSProperties | null =
    isCenter || !rect
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
      {isCenter && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10000 }}
          onClick={() => void finish()}
        />
      )}
      {ringStyle && <div style={ringStyle} aria-hidden="true" />}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-label="Product tour"
        style={tooltipStyle}
        className="rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          </div>
          <button
            aria-label="Close tour"
            onClick={() => void finish()}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {index + 1} of {total}
          </span>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {!isLast && (
              <Button size="sm" variant="ghost" onClick={() => void finish()}>
                Skip
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={() => void finish()}>
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
      </div>
    </>,
    document.body,
  );
}

/** The default tour steps for the CRM. Targets must match `data-tour` ids. */
export const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    target: "_center",
    title: "Welcome to Majix 👋",
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
