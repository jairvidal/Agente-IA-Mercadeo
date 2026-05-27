import { createFileRoute } from "@tanstack/react-router";

import { ClientsPage } from "@/features/clients";

export const Route = createFileRoute("/_dashboard/clients")({
  component: ClientsPage,
});
