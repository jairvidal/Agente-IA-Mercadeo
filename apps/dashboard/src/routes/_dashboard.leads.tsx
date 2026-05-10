import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import type { KanbanItem } from "@/components/kanban/kanban-board";
import { LeadsKanban } from "@/features/leads/leads-kanban";
import { apiClient, ApiError } from "@/lib/api";

export const Route = createFileRoute("/_dashboard/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      try {
        return await apiClient.get<KanbanItem[]>("/leads");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return [];
        }
        throw err;
      }
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Target />}
        title="Leads"
        description="Gestiona tu pipeline de leads"
      />
      <LeadsKanban leads={leads} />
    </div>
  );
}
