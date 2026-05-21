import { apiClient } from "@/lib/api";

import { dashboardStatsSchema, type DashboardStats } from "../schemas/dashboard-stats-schema";

export async function fetchStats(): Promise<DashboardStats> {
  const data = await apiClient.get<unknown>("/stats");
  return dashboardStatsSchema.parse(data);
}
