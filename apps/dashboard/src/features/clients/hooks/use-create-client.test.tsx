import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Client } from "../schemas/client-schema";

const { createClientMock, toastMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("../api/clients-api", async () => {
  const actual = await vi.importActual<typeof import("../api/clients-api")>(
    "../api/clients-api",
  );
  return {
    ...actual,
    createClient: createClientMock,
  };
});

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn() }),
}));

import { useCreateClient } from "./use-create-client";

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const samplePayload = {
  name: "Test User",
  email: "test@example.com",
  company: "Test Co",
  phone: "+57 300 000 0000",
};

const createdClient: Client = {
  id: "new-1",
  name: "Test User",
  email: "test@example.com",
  company: "Test Co",
  phone: "+57 300 000 0000",
  status: "ACTIVE",
  createdAt: "2026-05-26T10:00:00.000Z",
  _count: { quotes: 0 },
};

beforeEach(() => {
  createClientMock.mockReset();
  toastMock.mockReset();
});

describe("useCreateClient", () => {
  it("calls createClient with the payload", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    createClientMock.mockResolvedValueOnce(createdClient);

    const { result } = renderHook(() => useCreateClient(), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync(samplePayload);
    });

    expect(createClientMock).toHaveBeenCalledWith(samplePayload);
  });

  it("invalidates clients query and shows success toast on success", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    createClientMock.mockResolvedValueOnce(createdClient);

    const { result } = renderHook(() => useCreateClient(), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync(samplePayload);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["clients"] });
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Cliente creado",
      variant: "success",
    });
  });

  it("shows destructive toast on error", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    createClientMock.mockRejectedValueOnce(new Error("Boom"));

    const { result } = renderHook(() => useCreateClient(), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync(samplePayload).catch(() => {
        // expected
      });
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Error al crear cliente",
        variant: "destructive",
      });
    });
  });
});
