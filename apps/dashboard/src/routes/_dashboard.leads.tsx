import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { KanbanItem } from "@/components/kanban/kanban-board";
import { LeadsKanban } from "@/features/leads/leads-kanban";
import { apiClient } from "@/lib/api";

export const Route = createFileRoute("/_dashboard/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["leads"],
    queryFn: () => apiClient.get<KanbanItem[]>("/leads"),
  });

  const header = (
    <PageHeader icon={<Target />} title="Leads" description="Gestiona tu pipeline de leads" />
  );

  if (isError) {
    return (
      <div className="space-y-6">
        {header}
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 py-12 px-6 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">No pudimos cargar los leads</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {error instanceof Error ? error.message : "Error desconocido"}
            </p>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
            <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {isFetching ? "Reintentando…" : "Reintentar"}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        {header}
        <LeadsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <LeadsKanban leads={data} />
    </div>
  );
}

function LeadsSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4" aria-busy="true" aria-label="Cargando leads">
      {Array.from({ length: 6 }).map((_, col) => (
        <div key={col} className="flex flex-col w-64 shrink-0">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="h-2.5 w-2.5 rounded-full bg-gray-200" />
            <div className="h-3 w-20 rounded bg-gray-200" />
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-2 min-h-[200px]">
            {Array.from({ length: 2 }).map((_, card) => (
              <div
                key={card}
                className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm animate-pulse"
              >
                <div className="h-3 w-2/3 rounded bg-gray-200" />
                <div className="h-2.5 w-1/2 rounded bg-gray-200 mt-2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
