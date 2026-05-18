import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FileText, LayoutDashboard, RefreshCw, Target, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { apiClient } from "@/lib/api";

interface DashboardStats {
  totalLeads: number;
  totalClients: number;
  totalQuotes: number;
  openQuotes: number;
}

export const Route = createFileRoute("/_dashboard/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => apiClient.get<DashboardStats>("/stats"),
  });

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Target />} label="Total Leads" value={data.totalLeads} />
        <StatCard icon={<Users />} label="Total Clientes" value={data.totalClients} />
        <StatCard icon={<FileText />} label="Total Cotizaciones" value={data.totalQuotes} />
        <StatCard
          icon={<FileText />}
          label="Cotizaciones Abiertas"
          value={data.openQuotes}
          sublabel="Borrador + Enviadas"
          progress={data.totalQuotes > 0 ? Math.round((data.openQuotes / data.totalQuotes) * 100) : 0}
        />
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true" aria-label="Cargando estadísticas">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-xl border border-border p-5 shadow-soft animate-pulse"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-4 rounded bg-secondary" />
            <div className="h-3 w-24 rounded bg-secondary" />
          </div>
          <div className="h-8 w-16 rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}

function StatsError({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 py-12 px-6 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">No pudimos cargar las estadísticas</p>
        <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      </div>
      <Button onClick={onRetry} disabled={retrying} variant="outline" size="sm">
        <RefreshCw className={retrying ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {retrying ? "Reintentando…" : "Reintentar"}
      </Button>
    </div>
  );
}
