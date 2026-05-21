/**
 * useTourKeyboardNav — binds ArrowLeft / ArrowRight / Space / Escape to
 * step navigation while a ProductTour is open. Space and ArrowRight advance
 * to the next step (no-op on the last step); ArrowLeft goes back; Escape
 * closes the tour.
 */
import { useEffect } from "react";

interface UseTourKeyboardNavArgs {
  open: boolean;
  index: number;
  total: number;
  setIndex: (updater: (i: number) => number) => void;
  onClose: () => void;
}

export function useTourKeyboardNav({
  open,
  index,
  total,
  setIndex,
  onClose,
}: UseTourKeyboardNavArgs) {
  useEffect(() => {
    if (!open) return;
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
  }, [open, index, total, setIndex, onClose]);
}
