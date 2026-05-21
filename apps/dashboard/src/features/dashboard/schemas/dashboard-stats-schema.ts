import { z } from "zod";

export const dashboardStatsSchema = z.object({
  totalLeads: z.number().int().nonnegative(),
  totalClients: z.number().int().nonnegative(),
  totalQuotes: z.number().int().nonnegative(),
  openQuotes: z.number().int().nonnegative(),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
