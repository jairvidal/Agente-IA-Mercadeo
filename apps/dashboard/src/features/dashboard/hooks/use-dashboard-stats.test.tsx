import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";

const getMock = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    apiClient: {
      get: (...args: unknown[]) => getMock(...args),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import { useDashboardStats } from "./use-dashboard-stats";

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const validPayload = {
  totalLeads: 12,
  totalClients: 4,
  totalQuotes: 7,
  openQuotes: 3,
};

describe("useDashboardStats", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("returns parsed stats on success", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    getMock.mockResolvedValueOnce(validPayload);

    const { result } = renderHook(() => useDashboardStats(), { wrapper: wrap(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMock).toHaveBeenCalledWith("/stats");
    expect(result.current.data).toEqual(validPayload);
  });

  it("surfaces ApiError when the request fails", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    getMock.mockRejectedValueOnce(new ApiError(500, "Boom"));

    const { result } = renderHook(() => useDashboardStats(), { wrapper: wrap(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  it("errors when the response does not match the schema", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    getMock.mockResolvedValueOnce({ ...validPayload, totalLeads: -1 });

    const { result } = renderHook(() => useDashboardStats(), { wrapper: wrap(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
