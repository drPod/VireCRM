/**
 * Shared types and layout constants for ProductTour and its extracted pieces.
 */

export interface TourStep {
  /** data-tour id of the target element. Use "_center" for a centered modal step (no anchor). */
  target: string;
  title: string;
  body: string;
  /** Preferred placement; we'll auto-flip if it doesn't fit. */
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type Placement = "top" | "bottom" | "left" | "right";

export const RING_PADDING = 6;
export const TOOLTIP_GAP = 12;
export const TOOLTIP_WIDTH = 320;
export const CARET_SIZE = 8;
