import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Client } from "../schemas/client-schema";

const { fetchClientsMock } = vi.hoisted(() => ({
  fetchClientsMock: vi.fn(),
}));

vi.mock("../api/clients-api", async () => {
  const actual = await vi.importActual<typeof import("../api/clients-api")>(
    "../api/clients-api",
  );
  return {
    ...actual,
    fetchClients: fetchClientsMock,
  };
});

import { useClients } from "./use-clients";

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const sampleClient: Client = {
  id: "x",
  name: "Sample",
  email: null,
  company: null,
  phone: null,
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  _count: { quotes: 0 },
};

beforeEach(() => {
  fetchClientsMock.mockReset();
});

describe("useClients", () => {
  it("returns clients data on success", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    fetchClientsMock.mockResolvedValueOnce([sampleClient]);

    const { result } = renderHook(() => useClients(), { wrapper: wrap(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchClientsMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([sampleClient]);
  });

  it("surfaces error when fetchClients rejects", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    fetchClientsMock.mockRejectedValueOnce(new Error("Boom"));

    const { result } = renderHook(() => useClients(), { wrapper: wrap(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
