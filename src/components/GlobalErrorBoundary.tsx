import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReportIssueDialog } from "@/components/ReportIssueDialog";
import { handleAuthError } from "@/lib/server-fn-auth";

const DEFAULT_SUPPORT_EMAIL = "genesis@genesisx.space";

// Hosts that always use the default support email (never resolve a reseller).
const SYSTEM_HOST_PATTERNS = [
  /\.lovable\.app$/i,
  /\.lovable-project\.com$/i,
  /\.lovableproject\.com$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/i,
  /^vireonx\.space$/i,
  /^www\.vireonx\.space$/i,
];

function isSystemHost(hostname: string): boolean {
  return SYSTEM_HOST_PATTERNS.some((p) => p.test(hostname));
}

/**
 * Resolves the support email for the current hostname. The boundary renders
 * ABOVE DomainBrandingProvider, so we can't use the context — we re-query the
 * same RPC directly. Falls back to the platform default for system hosts or
 * when no reseller branding is found / RPC fails.
 */
function useResolvedSupportEmail(): string {
  const [email, setEmail] = useState<string>(DEFAULT_SUPPORT_EMAIL);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    if (isSystemHost(host)) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("get_org_by_domain", {
          p_hostname: host,
        });
        if (cancelled || error || !data) return;
        const branding = data as unknown as { support_email: string | null };
        if (branding.support_email) setEmail(branding.support_email);
      } catch {
        // ignore — keep default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return email;
}

function SupportEmailLine() {
  const email = useResolvedSupportEmail();
  return (
    <p className="mt-4 text-xs text-muted-foreground">
      Email{" "}
      <a
        href={`mailto:${email}`}
        className="font-medium text-foreground underline-offset-2 hover:underline"
      >
        {email}
      </a>
    </p>
  );
}

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
  componentStack: string | null;
  reportOpen: boolean;
}

/**
 * Top-level React error boundary that catches errors thrown by providers
 * (AuthProvider, DomainBrandingProvider, etc.) and any descendant component
 * that escapes TanStack Router's per-route `errorComponent`. Without this,
 * a thrown render-time error in a provider would crash to a blank white page.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, reportOpen: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Auth failures from server-fn calls shouldn't render the crash screen —
    // toast + redirect to /login instead, then clear the boundary state.
    if (handleAuthError(error)) {
      this.setState({ error: null, componentStack: null });
      return;
    }
    // eslint-disable-next-line no-console
    console.error("GlobalErrorBoundary caught:", error, info);
    this.setState({ componentStack: info.componentStack ?? null });
    void logErrorToSupabase(error, info);
  }

  reset = () => {
    this.setState({ error: null, componentStack: null, reportOpen: false });
  };

  openReport = () => this.setState({ reportOpen: true });
  setReportOpen = (open: boolean) => this.setState({ reportOpen: open });

  render() {
    const { error, componentStack, reportOpen } = this.state;
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
            <button
              type="button"
              onClick={this.openReport}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Report this issue
            </button>
          </div>
          <SupportEmailLine />
        </div>
        <ReportIssueDialog
          open={reportOpen}
          onOpenChange={this.setReportOpen}
          error={error}
          componentStack={componentStack}
        />
      </div>
    );
  }
}

