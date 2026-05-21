/**
 * useTourPositioning — resolves the target element for a ProductTour step,
 * tracks its rect through scroll/resize, and computes the tooltip + caret +
 * highlight-ring styles with auto-flip so nothing overflows the viewport.
 *
 * The positioning math (auto-flip order: right → left → bottom → top, then
 * clamp) is preserved byte-for-byte from the original inline implementation.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import {
  CARET_SIZE,
  RING_PADDING,
  TOOLTIP_GAP,
  TOOLTIP_WIDTH,
  type Placement,
  type Rect,
  type TourStep,
} from "@/components/onboarding/product-tour.types";

interface UseTourPositioningArgs {
  open: boolean;
  step: TourStep | undefined;
  isCenter: boolean;
}

interface UseTourPositioningResult {
  effectiveIsCenter: boolean;
  tooltipStyle: React.CSSProperties;
  caretStyle: React.CSSProperties | null;
  ringStyle: React.CSSProperties | null;
}

function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function useTourPositioning({
  open,
  step,
  isCenter,
}: UseTourPositioningArgs): UseTourPositioningResult {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [elementNotFound, setElementNotFound] = useState(false);

  // Track viewport size for repositioning.
  useEffect(() => {
    if (!open) return;
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

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

  // When the target element couldn't be found, fall back to centered rendering
  // so the tooltip is still visible rather than disappearing entirely.
  const effectiveIsCenter = isCenter || elementNotFound;

  // On narrow viewports cap the tooltip so it doesn't overflow the screen edge.
  // Fall back to TOOLTIP_WIDTH when viewport hasn't been measured yet (w === 0).
  const effectiveTooltipWidth =
    viewport.w > 0 ? Math.min(TOOLTIP_WIDTH, viewport.w - 24) : TOOLTIP_WIDTH;

  // Compute tooltip position based on placement + viewport.
  // `placement` is lifted out so the caret computation can reference it.
  let placement: Placement = "right";
  const tooltipStyle: React.CSSProperties = (() => {
    if (effectiveIsCenter || !rect || !step) {
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

  return {
    effectiveIsCenter,
    tooltipStyle,
    caretStyle,
    ringStyle,
  };
}
