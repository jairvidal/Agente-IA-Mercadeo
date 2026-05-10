import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, LayoutDashboard, Target, Users } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { apiClient, ApiError } from "@/lib/api";

interface DashboardStats {
  totalLeads: number;
  totalClients: number;
  totalQuotes: number;
  openQuotes: number;
}

const FALLBACK_STATS: DashboardStats = {
  totalLeads: 0,
  totalClients: 0,
  totalQuotes: 0,
  openQuotes: 0,
};

export const Route = createFileRoute("/_dashboard/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      try {
        return await apiClient.get<DashboardStats>("/stats");
      } catch (err) {
        // Endpoint not yet implemented in backend — show zeros.
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return FALLBACK_STATS;
        }
        throw err;
      }
    },
    initialData: FALLBACK_STATS,
  });

  const { totalLeads, totalClients, totalQuotes, openQuotes } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard />}
        title="Dashboard"
        description="Resumen general del CRM"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Target />} label="Total Leads" value={totalLeads} />
        <StatCard icon={<Users />} label="Total Clientes" value={totalClients} />
        <StatCard icon={<FileText />} label="Total Cotizaciones" value={totalQuotes} />
        <StatCard
          icon={<FileText />}
          label="Cotizaciones Abiertas"
          value={openQuotes}
          sublabel="Borrador + Enviadas"
          progress={totalQuotes > 0 ? Math.round((openQuotes / totalQuotes) * 100) : 0}
        />
      </div>
    </div>
  );
}
