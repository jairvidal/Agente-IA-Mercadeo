import { useQuery } from "@tanstack/react-query";

import { fetchStats } from "../api/dashboard-api";

export const dashboardStatsQueryOptions = {
  queryKey: ["dashboard", "stats"] as const,
  queryFn: fetchStats,
};

export function useDashboardStats() {
  return useQuery(dashboardStatsQueryOptions);
}
