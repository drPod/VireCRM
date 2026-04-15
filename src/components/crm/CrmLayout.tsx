import { Outlet } from "@tanstack/react-router";
import { CrmSidebar } from "./CrmSidebar";

export function CrmLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <CrmSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
