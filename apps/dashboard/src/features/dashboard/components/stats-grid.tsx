import { FileText, Target, Users } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";

import type { DashboardStats } from "../schemas/dashboard-stats-schema";

interface StatsGridProps {
  stats: DashboardStats;
}

function calcOpenQuotesProgress(stats: DashboardStats) {
  if (stats.totalQuotes === 0) return 0;
  return Math.round((stats.openQuotes / stats.totalQuotes) * 100);
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={<Target />} label="Total Leads" value={stats.totalLeads} />
      <StatCard icon={<Users />} label="Total Clientes" value={stats.totalClients} />
      <StatCard icon={<FileText />} label="Total Cotizaciones" value={stats.totalQuotes} />
      <StatCard
        icon={<FileText />}
        label="Cotizaciones Abiertas"
        value={stats.openQuotes}
        sublabel="Borrador + Enviadas"
        progress={calcOpenQuotesProgress(stats)}
      />
    </div>
  );
}
