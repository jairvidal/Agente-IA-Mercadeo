import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AuthTokenRefresher } from "@/components/auth/auth-token-refresher";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const Route = createFileRoute("/_dashboard")({
  // TODO: when the backend exposes `GET /auth/session`, replace this
  // stub with a real check (fetch session, redirect to /login on 401).
  beforeLoad: async () => {
    const authenticated = true;
    if (!authenticated) {
      throw redirect({ to: "/login" });
    }
  },
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
