import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Single-flight lock for click-driven async actions (e.g. "Test", "Send",
 * "Verify" buttons that hit the network).
 *
 * Why not just `disabled={loading}` on the button?
 *  - `setLoading(true)` is async — between two synchronous click events in
 *    the same microtask the button is still enabled, so two requests can
 *    fire. We use a ref for instant lockout the moment a run starts.
 *  - After the request returns, fast follow-up clicks (double-click,
 *    impatient user) can immediately fire another request before the user
 *    has had a chance to read the result. A short cooldown debounces this.
 *  - Concurrent calls from different code paths (e.g. polling effect + a
 *    manual click) get coalesced — only the first one runs, the rest are
 *    rejected synchronously.
 *
 * Returns:
 *  - `run(fn)`: invoke `fn` if no run is in progress and the cooldown has
 *    elapsed. Returns the awaited result, or `undefined` if it was skipped.
 *  - `loading`: true while a run is in progress.
 *  - `locked`: true while a run is in progress OR within the cooldown
 *    window. Use this for `disabled={locked}` on the button.
 */
export function useActionLock(options?: { cooldownMs?: number }) {
  const cooldownMs = options?.cooldownMs ?? 600;
  const inFlightRef = useRef(false);
  const lastFinishedAtRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [cooling, setCooling] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks mounted state so we don't call setState after unmount (e.g. the
  // settings page closes mid-request).
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const run = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      // Guard 1: another run is already in flight. Synchronous check via ref
      // so two clicks in the same tick can't both pass.
      if (inFlightRef.current) return undefined;
      // Guard 2: still within the cooldown after the last successful run.
      if (Date.now() - lastFinishedAtRef.current < cooldownMs) return undefined;

      inFlightRef.current = true;
      if (mountedRef.current) setLoading(true);
      try {
        return await fn();
      } finally {
        inFlightRef.current = false;
        lastFinishedAtRef.current = Date.now();
        if (mountedRef.current) {
          setLoading(false);
          setCooling(true);
        }
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setCooling(false);
        }, cooldownMs);
      }
    },
    [cooldownMs],
  );

  return {
    run,
    loading,
    locked: loading || cooling,
  };
}
