// Lightweight cross-component signal for lead mutations that Supabase realtime
// may not deliver reliably (e.g. soft deletes, where the row's RLS visibility
// flips on UPDATE and the change event is suppressed for subscribers).
//
// Components that show leads should listen for `leads:changed` and refetch.
// Components that mutate leads (delete, archive, status move) should call
// `notifyLeadsChanged()` after a successful write.

export const LEADS_CHANGED_EVENT = "leads:changed";

export function notifyLeadsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LEADS_CHANGED_EVENT));
}

export function onLeadsChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const wrapped = () => handler();
  window.addEventListener(LEADS_CHANGED_EVENT, wrapped);
  return () => window.removeEventListener(LEADS_CHANGED_EVENT, wrapped);
}
