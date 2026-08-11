import {
  Building2,
  FileSignature,
  FileText,
  Handshake,
  LogOut,
  SquareKanban,
  Tags,
  Users,
} from "lucide-react";
import { NavLink, Outlet, redirect, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { supabase } from "~/lib/supabase";
import { cn } from "~/lib/utils";
import { captureException } from "~/sentry.client";
import type { Route } from "./+types/app-layout";

// Session gate for every app page. Auth lives in the browser (supabase-js),
// so this is a clientLoader; the server renders HydrateFallback meanwhile.
export async function clientLoader() {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw redirect("/login");
  return {
    email: data.session.user.email ?? null,
    tenant: window.location.hostname.split(".")[0] ?? "",
  };
}

export function HydrateFallback() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-56 shrink-0 border-r bg-sidebar p-4 md:block">
        <Skeleton className="h-6 w-32" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    </div>
  );
}

const NAV = [
  { to: "/", label: "Pipeline", icon: SquareKanban, end: true },
  { to: "/in-pricing", label: "In Pricing", icon: Tags, end: false },
  { to: "/current-clients", label: "Current Clients", icon: Building2, end: false },
  { to: "/customers", label: "Customers", icon: Users, end: false },
  { to: "/deals", label: "Deals", icon: Handshake, end: false },
  { to: "/contracts", label: "Contracts", icon: FileText, end: false },
  { to: "/loas", label: "LOAs", icon: FileSignature, end: false },
] as const;

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();

  async function signOut() {
    try {
      // Supabase v2 reports sign-out failures via `{ error }` on the resolved
      // value; some edge cases (network down, session missing) still throw.
      // Either way the SDK clears the local session first, so always proceed
      // to /login — but don't swallow the failure silently.
      const { error } = await supabase().auth.signOut();
      if (error) {
        captureException(error, { tags: { layer: "auth-logout" } });
      }
    } catch (err) {
      captureException(err, { tags: { layer: "auth-logout" } });
    }
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 flex h-svh w-56 shrink-0 flex-col border-r bg-sidebar max-md:hidden">
        <div className="px-4 py-5">
          <p className="text-lg font-semibold tracking-tight">VireCRM</p>
          <p className="truncate text-xs text-muted-foreground">{loaderData.tenant}</p>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <Separator />
        <div className="flex items-center justify-between gap-2 p-3">
          <p className="truncate text-xs text-muted-foreground" title={loaderData.email ?? ""}>
            {loaderData.email}
          </p>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="border-b px-4 py-2 md:hidden">
          <nav className="flex gap-1 overflow-x-auto">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                    isActive ? "bg-accent font-medium" : "text-muted-foreground",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
