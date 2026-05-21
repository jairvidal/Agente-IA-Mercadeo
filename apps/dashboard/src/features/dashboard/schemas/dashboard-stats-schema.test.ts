import { describe, expect, it } from "vitest";

import { dashboardStatsSchema } from "./dashboard-stats-schema";

describe("dashboardStatsSchema", () => {
  it("accepts a valid payload", () => {
    const result = dashboardStatsSchema.safeParse({
      totalLeads: 12,
      totalClients: 4,
      totalQuotes: 7,
      openQuotes: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts zeroed counters", () => {
    const result = dashboardStatsSchema.safeParse({
      totalLeads: 0,
      totalClients: 0,
      totalQuotes: 0,
      openQuotes: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative counters", () => {
    const result = dashboardStatsSchema.safeParse({
      totalLeads: -1,
      totalClients: 0,
      totalQuotes: 0,
      openQuotes: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["totalLeads"]);
    }
  });

  it("rejects non-integer counters", () => {
    const result = dashboardStatsSchema.safeParse({
      totalLeads: 1.5,
      totalClients: 0,
      totalQuotes: 0,
      openQuotes: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["totalLeads"]);
    }
  });

  it("rejects missing fields", () => {
    const result = dashboardStatsSchema.safeParse({
      totalLeads: 1,
      totalClients: 1,
      totalQuotes: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["openQuotes"]);
    }
  });
});
