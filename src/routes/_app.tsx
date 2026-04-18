import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

// Routes inside /_app that are reachable WITHOUT an active subscription
// (so users can pay, manage billing, or change settings even when blocked).
const FREE_PATHS = new Set<string>(["/billing", "/settings"]);

function AppLayout() {
  const { user, loading } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription(user?.id);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [loading, user, navigate]);

  // Hard entitlement gate: redirect to /billing when no active sub.
  useEffect(() => {
    if (loading || subLoading || !user) return;
    if (hasAccess) return;
    if (FREE_PATHS.has(location.pathname)) return;
    navigate({ to: "/billing", search: { required: "1" } as never });
  }, [loading, subLoading, user, hasAccess, location.pathname, navigate]);

  if (loading || (user && subLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PaymentTestModeBanner />
      <div className="flex flex-1 overflow-hidden">
        <CrmSidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
