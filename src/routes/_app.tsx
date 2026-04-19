import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

// Routes inside /_app that are reachable WITHOUT an active subscription
// (so users can pay, manage billing, or change settings even when blocked).
const FREE_PATHS = new Set<string>(["/billing", "/settings"]);

function LoadingShell() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  const { user, loading } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription(user?.id);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!hydrated) return;
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [hydrated, loading, user, navigate]);

  // Hard entitlement gate: redirect to /billing when no active sub.
  useEffect(() => {
    if (!hydrated) return;
    if (loading || subLoading || !user) return;
    if (hasAccess) return;
    if (FREE_PATHS.has(location.pathname)) return;
    navigate({ to: "/billing", search: { required: "1" } as never });
  }, [hydrated, loading, subLoading, user, hasAccess, location.pathname, navigate]);

  if (!hydrated || loading || (user && subLoading)) {
    return <LoadingShell />;
  }

  if (!user) return <LoadingShell />;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PaymentTestModeBanner />
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <CrmSidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
