/**
 * Pure helpers for the /preview page read-only shield.
 *
 * The shield wraps the preview UI and intercepts pointer + keyboard
 * activation on any interactive element that doesn't explicitly opt in
 * via `data-preview-allow="true"`. Extracted into a standalone module so
 * the logic can be unit-tested without mounting the full route tree.
 */

export const ALLOW_ATTR = "data-preview-allow";

/** Selector for elements that should never trigger real side effects. */
export const BLOCKED_INTERACTIVE_SELECTOR = [
  "button",
  "a",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  "select",
  "summary",
  "[data-preview-block]",
].join(", ");

/** Selector for click-time interactives (subset – pointer activation). */
export const BLOCKED_CLICK_SELECTOR = [
  "button",
  "a",
  '[role="button"]',
  '[role="link"]',
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  "select",
  "[data-preview-block]",
].join(", ");

/** Selector for editable controls where typing must remain unaffected. */
export const EDITABLE_SELECTOR = [
  'input:not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])',
  "textarea",
  '[contenteditable="true"]',
  '[contenteditable=""]',
].join(", ");

/** True if `target` (or an ancestor) opted out of the shield. */
export function isAllowed(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(`[${ALLOW_ATTR}="true"]`) !== null;
}

/** Keys that activate buttons/links/checkboxes per ARIA & native semantics. */
export function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " " || key === "Spacebar";
}

/**
 * Decide whether a keyboard event on `target` should be blocked by the
 * read-only shield. Returns `true` if the event must be `preventDefault`'d
 * and the user should be notified.
 */
export function shouldBlockKeyboardEvent(
  key: string,
  target: EventTarget | null,
): boolean {
  if (!isActivationKey(key)) return false;
  if (!(target instanceof Element)) return false;
  if (isAllowed(target)) return false;
  if (target.closest(EDITABLE_SELECTOR)) return false;
  return target.closest(BLOCKED_INTERACTIVE_SELECTOR) !== null;
}

/** Decide whether a pointer (click) event must be blocked. */
export function shouldBlockClickEvent(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (isAllowed(target)) return false;
  return target.closest(BLOCKED_CLICK_SELECTOR) !== null;
}
