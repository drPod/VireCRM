/**
 * TourNav — progress dots on the left, Back/Skip/Next (or Got it!) buttons
 * on the right. Owns no state — purely presentational; the container drives
 * index changes and completion.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TourNavProps {
  total: number;
  index: number;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function TourNav({ total, index, isLast, onBack, onNext, onSkip, onComplete }: TourNavProps) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
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
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        )}
        {!isLast && (
          <Button size="sm" variant="ghost" onClick={onSkip}>
            Skip
          </Button>
        )}
        {isLast ? (
          <Button size="sm" onClick={onComplete}>
            Got it!
          </Button>
        ) : (
          <Button size="sm" onClick={onNext}>
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
