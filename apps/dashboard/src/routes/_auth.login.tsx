import { createFileRoute, redirect } from "@tanstack/react-router";

// TODO: replace stub with real login form once the backend exposes
// `POST /auth/login`. For now we mirror the template behavior and bounce
// straight to the dashboard.
export const Route = createFileRoute("/_auth/login")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
