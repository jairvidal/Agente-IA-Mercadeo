import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AuthTokenRefresher, requireSession } from "@/features/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: requireSession,
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <>
      <AuthTokenRefresher />
      <DashboardShell>
        <Outlet />
      </DashboardShell>
    </>
  );
}
