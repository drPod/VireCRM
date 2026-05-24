import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Lightweight light/dark theme provider for React Router v7 SPA.
 *
 * Pattern: persists choice to `localStorage`, toggles `.dark` class on
 * `document.documentElement`. Avoids `next-themes` (Next.js-only) and
 * `remix-themes` (extra dependency for what's effectively a 60-line module).
 *
 * Initial value resolves client-side on mount to avoid SSR/CSR mismatch:
 * server renders no class; first effect applies stored or system preference.
 */

type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: Resolved;
  setTheme: (theme: Theme) => void;
};

const STORAGE_KEY = "genesisxsx.theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function resolve(theme: Theme): Resolved {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<Resolved>("light");

  // Hydrate from localStorage on mount.
  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  // Apply resolved theme to <html>, and track OS-level changes in "system" mode.
  useEffect(() => {
    const apply = (next: Resolved) => {
      setResolvedTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    apply(resolve(theme));

    if (theme !== "system") return;
    const media = window.matchMedia(MEDIA_QUERY);
    const onChange = () => apply(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
