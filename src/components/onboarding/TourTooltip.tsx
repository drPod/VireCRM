/**
 * TourTooltip — the dialog card portion of ProductTour: sparkle icon,
 * title/body, close button, optional caret pointing at the target, plus
 * the embedded TourNav (progress dots + Back/Skip/Next/Got it!) and the
 * keyboard-hint footer line.
 *
 * The wrapping `<div role="dialog">` exposes `ref` so the container can
 * move focus to it on step changes.
 */
import { forwardRef } from "react";
import { Sparkles, X } from "lucide-react";
import { TourNav } from "./TourNav";
import { type TourStep } from "./product-tour.types";

interface TourTooltipProps {
  step: TourStep;
  total: number;
  index: number;
  isLast: boolean;
  tooltipStyle: React.CSSProperties;
  caretStyle: React.CSSProperties | null;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export const TourTooltip = forwardRef<HTMLDivElement, TourTooltipProps>(function TourTooltip(
  { step, total, index, isLast, tooltipStyle, caretStyle, onClose, onBack, onNext, onSkip, onComplete },
  ref,
) {
  return (
    <>
      {/* Live region announces step changes to screen readers. */}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {index + 1} of {total}: {step.title}
      </span>

      <div
        ref={ref}
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

        <TourNav
          total={total}
          index={index}
          isLast={isLast}
          onBack={onBack}
          onNext={onNext}
          onSkip={onSkip}
          onComplete={onComplete}
        />
        <p className="mt-2 text-center text-xs text-muted-foreground/60">
          ← → navigate · Esc close
        </p>
      </div>
    </>
  );
});
