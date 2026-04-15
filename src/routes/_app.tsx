import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CrmSidebar } from "@/components/crm/CrmSidebar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <CrmSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
