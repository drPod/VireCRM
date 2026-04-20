import { Component, type ErrorInfo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// Best-effort: log a caught error to the error_logs table for production review.
// Never throws — failures are swallowed to avoid loops inside the boundary.
async function logErrorToSupabase(error: Error, info: ErrorInfo): Promise<void> {
  try {
    let userId: string | null = null;
    let organizationId: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user?.id ?? null;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", userId)
          .maybeSingle();
        organizationId = profile?.organization_id ?? null;
      }
    } catch {
      // ignore — we still want to log the error itself
    }

    await supabase.from("error_logs").insert({
      message: error.message?.slice(0, 2000) || "Unknown error",
      stack: error.stack?.slice(0, 8000) ?? null,
      component_stack: info.componentStack?.slice(0, 8000) ?? null,
      url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      user_id: userId,
      organization_id: organizationId,
      metadata: { name: error.name },
    });
  } catch {
    // Swallow — never let logging break the boundary fallback.
  }
}

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level React error boundary that catches errors thrown by providers
 * (AuthProvider, DomainBrandingProvider, etc.) and any descendant component
 * that escapes TanStack Router's per-route `errorComponent`. Without this,
 * a thrown render-time error in a provider would crash to a blank white page.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging in dev tools / error monitoring.
    // Avoid throwing from within the boundary itself.
    // eslint-disable-next-line no-console
    console.error("GlobalErrorBoundary caught:", error, info);
    // Fire-and-forget: persist to Supabase so we can review production crashes.
    void logErrorToSupabase(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The app hit an unexpected error. Try reloading — if it keeps happening, please let us
            know.
          </p>
          {import.meta.env.DEV && error.message && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
              {error.message}
            </pre>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                this.reset();
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Reload
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Go home
            </a>
            <a
              href={(() => {
                const url = typeof window !== "undefined" ? window.location.href : "(unknown)";
                const subject = `Vireon issue report: ${error.message?.slice(0, 80) || "Unexpected error"}`;
                const body = [
                  "Hi Vireon team,",
                  "",
                  "I hit an unexpected error in the app. Details below:",
                  "",
                  `URL: ${url}`,
                  `Error: ${error.message || "Unknown error"}`,
                  `Time: ${new Date().toISOString()}`,
                  "",
                  "What I was doing when it happened:",
                  "(please describe)",
                ].join("\n");
                return `mailto:support@vireonx.space?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              })()}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Report this issue
            </a>
          </div>
        </div>
      </div>
    );
  }
}
