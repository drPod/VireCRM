import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useSubscription } from "@/hooks/useSubscription";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ProductTour, DEFAULT_TOUR_STEPS } from "@/components/onboarding/ProductTour";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/PageTransition";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

// Restrict the redirect target to safe in-app paths so a forged ?redirect=
// param can't bounce a freshly-signed-in user to an external phishing page.
function safeReturnTo(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  return path;
}

// Routes inside /_app that are reachable WITHOUT an active subscription
// (so users can pay, manage billing, or change settings even when blocked).
const FREE_PATHS = new Set<string>(["/billing", "/settings"]);

function LoadingShell() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading workspace"
      className="flex h-screen bg-background"
    >
      <span className="sr-only">
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        Loading your workspace
      </span>
      {/* Sidebar skeleton — matches CrmSidebar's w-64 rail so first paint
          doesn't shift when auth hydrates. Hidden on mobile (sidebar is a
          sheet there). */}
      <aside
        aria-hidden="true"
        className="hidden h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex"
      >
        <div className="flex items-center gap-2 pb-4">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-base font-extrabold text-primary-foreground shadow-[0_0_18px_-4px_var(--color-primary)]"
          >
            M
          </span>
          <div className="h-4 w-24 rounded bg-sidebar-foreground/10 animate-pulse" />
        </div>
        <div className="mt-2 space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 animate-pulse"
            >
              <div className="h-4 w-4 rounded bg-sidebar-foreground/10" />
              <div
                className="h-3 rounded bg-sidebar-foreground/10"
                style={{ width: `${50 + ((i * 7) % 40)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-auto pt-4 border-t border-sidebar-border/60">
          <div className="flex items-center gap-2 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-sidebar-foreground/10" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 rounded bg-sidebar-foreground/10" />
              <div className="h-2 w-1/2 rounded bg-sidebar-foreground/10" />
            </div>
          </div>
        </div>
      </aside>
      {/* Content area skeleton */}
      <main className="flex-1 overflow-hidden p-6 space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-72 rounded bg-muted/70 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 space-y-3 animate-pulse"
            >
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted/70" />
              <div className="h-6 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
          <div className="h-4 w-1/3 rounded bg-muted" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 w-full rounded bg-muted/60" />
          ))}
        </div>
      </main>
    </div>
  );
}

function AppLayout() {
  // Hydration guard: auth lives in browser localStorage, so SSR has no session
  // and would render the login redirect. Returning a stable loading shell on
  // the server + first client render prevents hydration mismatch crashes that
  // produce a blank white page after SSR hands off to React.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const { user, loading, role, profile, organization } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription(user?.id);
  const navigate = useNavigate();
  const location = useLocation();

  // Onboarding state — read once per user, only blocks the UI when truly missing.
  // null = unknown, false = needed, true = done. We avoid fetching organization
  // here directly to dodge cross-deps with AuthProvider; instead we hit it once.
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user || !profile?.organization_id) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("onboarding_completed_at")
        .eq("id", profile.organization_id)
        .maybeSingle();
      if (!cancelled) setOnboardingDone(!!data?.onboarding_completed_at);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, profile?.organization_id]);

  // Product tour state — auto-launches on first sign-in once onboarding is
  // done. Persists `profiles.tour_completed_at` so it never auto-opens twice.
  // Users can manually reopen via the "Restart tour" button in the sidebar
  // (which sets `window.__genesisRestartTour = true` then dispatches an event).
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (!user) return;
    if (onboardingDone !== true) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tour_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!data?.tour_completed_at) {
        // Small delay so sidebar links are mounted before we measure them.
        setTimeout(() => setTourOpen(true), 100);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, onboardingDone]);

  // Listen for manual "Restart tour" requests from the sidebar.
  useEffect(() => {
    const handler = () => setTourOpen(true);
    window.addEventListener("virecrm:restart-tour", handler);
    return () => window.removeEventListener("virecrm:restart-tour", handler);
  }, []);

  // Avoid bouncing freshly-signed-in users back to /login: after a successful
  // signInWithPassword, navigate fires before AuthProvider's onAuthStateChange
  // listener has propagated the new user. Re-check Supabase's local session
  // directly before redirecting, so we only kick out genuinely unauthenticated
  // visitors.
  useEffect(() => {
    if (!hydrated) return;
    if (loading || user) return;

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        // Preserve the path (and query) the user was trying to reach so /login
        // can send them back after they sign in. Defaults to /dashboard.
        const returnTo = safeReturnTo(`${location.pathname}${location.searchStr || ""}` || "/dashboard");
        navigate({
          to: "/login",
          search: { redirect: returnTo } as never,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, loading, user, navigate, location.pathname, location.searchStr]);

  // Forced password-change gate. Fires after auth confirmed, before billing check.
  useEffect(() => {
    if (!hydrated) return;
    if (loading || !user) return;
    if (user.user_metadata?.must_change_password) {
      navigate({ to: "/change-password", search: { forced: "1" } });
    }
  }, [hydrated, loading, user, navigate]);

  // Hard entitlement gate: redirect to /billing when no active sub.
  // CRITICAL: only run AFTER user is known. If we redirect while user is still
  // null (post-sign-in race), the user lands on /billing and thinks login broke.
  useEffect(() => {
    if (!hydrated) return;
    if (loading || !user) return;
    if (subLoading) return;
    if (hasAccess) return;
    if (FREE_PATHS.has(location.pathname)) return;
    navigate({ to: "/billing", search: { required: "1" } as never });
  }, [hydrated, loading, subLoading, user, hasAccess, location.pathname, navigate]);

  if (!hydrated || loading || (user && subLoading)) {
    return <LoadingShell />;
  }

  if (!user) {
    // Auth check resolved → user is anonymous. The redirect effect above will
    // bounce to /login on the next tick; render a friendly stub instead of an
    // indefinite spinner so deep-linked visitors aren't stuck on a blank page.
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
        <a
          href="/login"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Go to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <CrmSidebar />
        <main className="flex-1 overflow-y-auto">
          {/* PageTransition restarts the fade animation imperatively so the
              page subtree is reused across navigations (no unmount thrash). */}
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      {/* First-time setup wizard — only renders when org has no completion stamp.
          Prefilled with current values so re-running doesn't feel destructive. */}
      {onboardingDone === false && profile?.organization_id && (
        <OnboardingWizard
          organizationId={profile.organization_id}
          isOwner={role?.role === "owner"}
          currentIndustry={
            (organization?.industry_template as
              | "general"
              | "energy"
              | "gym"
              | "solar"
              | "real_estate"
              | "insurance"
              | null
              | undefined) ?? null
          }
          currentBrandColor={organization?.primary_color ?? null}
          currentStrictIsolation={organization?.strict_lead_isolation ?? false}
          onComplete={() => setOnboardingDone(true)}
          noticeDismissed={profile?.wizard_notice_dismissed ?? false}
          onDismissNotice={async () => {
            if (!user) return;
            await supabase
              .from("profiles")
              .update({ wizard_notice_dismissed: true } as never)
              .eq("user_id", user.id);
          }}
        />
      )}
      {/* Interactive product tour for first-time users (auto-opens once
          onboarding is done; users can replay from the sidebar). */}
      <ProductTour
        steps={DEFAULT_TOUR_STEPS}
        open={tourOpen}
        userId={user?.id ?? null}
        onClose={() => setTourOpen(false)}
      />
    </div>
  );
}
