import { useEffect, useLayoutEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface TourStep {
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

export function GuidedTour({ steps, currentStep, onNavigate, onClose }: GuidedTourProps) {
  const [rect, setRect] = useState<TourRect | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const active = currentStep !== null ? steps[currentStep] : null;

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
        raf = window.requestAnimationFrame(measure);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };

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

  const spot = rect
    ? {
        top: Math.max(rect.top - PADDING, 8),
        left: Math.max(rect.left - PADDING, 8),
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;

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
      Math.min(spot.left + spot.width / 2 - TOOLTIP_WIDTH / 2, viewport.w - TOOLTIP_WIDTH - 16),
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

      <button
        type="button"
        aria-label="Close tour"
        data-preview-allow="true"
        onClick={onClose}
        className="absolute inset-0"
        tabIndex={-1}
      />

      {spot && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary/80 shadow-[0_0_0_4px_rgba(168,85,247,0.18),0_0_36px_rgba(168,85,247,0.45)] transition-[top,left,width,height] duration-300"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      )}

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
            className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="text-base font-semibold text-foreground">{active.title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{active.body}</p>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${
                i === currentStep ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" data-preview-allow="true" onClick={onClose}>
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
