import { LayoutDashboard } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";

import { useDashboardStats } from "../hooks/use-dashboard-stats";

import { StatsError } from "./stats-error";
import { StatsGrid } from "./stats-grid";
import { StatsSkeleton } from "./stats-skeleton";

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardStats();

  const header = (
    <PageHeader
      icon={<LayoutDashboard />}
      title="Dashboard"
      description="Resumen general del CRM"
    />
  );

  if (isError) {
    return (
      <div className="space-y-6">
        {header}
        <StatsError
          message={error instanceof Error ? error.message : "Error desconocido"}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        {header}
        <StatsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <StatsGrid stats={data} />
    </div>
  );
}
