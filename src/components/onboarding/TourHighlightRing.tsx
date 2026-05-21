/**
 * TourHighlightRing — fixed-position overlay drawing the bordered "ring"
 * around a ProductTour target element. Its box-shadow doubles as the
 * full-screen dim, so we don't need a separate dim layer when a target
 * exists.
 */

interface TourHighlightRingProps {
  style: React.CSSProperties;
}

export function TourHighlightRing({ style }: TourHighlightRingProps) {
  return <div style={style} aria-hidden="true" />;
}
