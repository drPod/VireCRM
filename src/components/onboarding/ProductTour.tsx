/**
 * ProductTour — lightweight, dependency-free interactive walkthrough that
 * guides brand-new users around the CRM on their first sign-in.
 *
 * Each step targets a DOM element by `data-tour="<id>"`. We:
 *   - find the element, scroll it into view, draw a highlight ring around it
 *     (see `useTourPositioning`)
 *   - render a tooltip card with title/body/Next/Skip controls, anchored
 *     near the highlighted element (auto-flips so it never goes off-screen)
 *   - on "Got it!" (final step only), persist `profiles.tour_completed_at` so the tour
 *     never auto-launches again; X/Skip/backdrop dismiss without writing to DB
 *
 * Re-positions on resize/scroll so it stays glued to its target.
 *
 * Runs only in the browser (no SSR usage of window/document at module scope).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { type IndustryKey } from "@/lib/industry-templates";
import { useTourPositioning } from "@/hooks/useTourPositioning";
import { useTourKeyboardNav } from "@/hooks/useTourKeyboardNav";
import { TourHighlightRing } from "./TourHighlightRing";
import { TourTooltip } from "./TourTooltip";
import { type TourStep } from "./product-tour.types";

// Re-export so callers can import both ProductTour and IndustryKey from this module.
export type { IndustryKey, TourStep };
export { DEFAULT_TOUR_STEPS, buildTourSteps } from "./product-tour-steps";

interface ProductTourProps {
  steps: TourStep[];
  open: boolean;
  /** User id so we can mark the tour completed in profiles. */
  userId: string | null;
  onClose: () => void;
}

export function ProductTour({ steps, open, userId, onClose }: ProductTourProps) {
  const [index, setIndex] = useState(0);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const step = steps[index];
  const isCenter = step?.target === "_center" || step?.placement === "center";
  const total = steps.length;
  const isLast = index === total - 1;

  // Reset to first step whenever the tour opens.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useTourKeyboardNav({ open, index, total, setIndex, onClose });

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

  const { effectiveIsCenter, tooltipStyle, caretStyle, ringStyle } = useTourPositioning({
    open,
    step,
    isCenter,
  });

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
      {ringStyle && <TourHighlightRing style={ringStyle} />}

      <TourTooltip
        ref={tooltipRef}
        step={step}
        total={total}
        index={index}
        isLast={isLast}
        tooltipStyle={tooltipStyle}
        caretStyle={caretStyle}
        onClose={onClose}
        onBack={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(total - 1, i + 1))}
        onSkip={onClose}
        onComplete={() => void completeTour()}
      />
    </>,
    document.body,
  );
}
