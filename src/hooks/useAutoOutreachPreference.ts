import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "majix.autoOutreachEnabled";

/**
 * User preference for whether AI auto-outreach fires after a lead is added or
 * imported. Persisted in localStorage so the toggle sticks across sessions on
 * the same browser. Defaults to ON — outreach has been the default behaviour
 * since the feature shipped, so we don't want to silently disable it for
 * existing users.
 */
export function useAutoOutreachPreference() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) return true;
      return raw === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // localStorage unavailable (private mode, quota) — ignore, in-memory state still works.
    }
  }, [enabled]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  return { enabled, setEnabled, toggle };
}
