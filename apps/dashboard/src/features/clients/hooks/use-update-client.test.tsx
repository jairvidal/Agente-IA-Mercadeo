import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Client } from "../schemas/client-schema";

const { updateClientMock, toastMock } = vi.hoisted(() => ({
  updateClientMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("../api/clients-api", async () => {
  const actual = await vi.importActual<typeof import("../api/clients-api")>(
    "../api/clients-api",
  );
  return {
    ...actual,
    updateClient: updateClientMock,
  };
});

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn() }),
}));

import { useUpdateClient } from "./use-update-client";

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const seedClients: Client[] = [
  {
    id: "client-1",
    name: "Alejandra Restrepo",
    email: "alejandra@example.com",
    company: "Inmobiliaria del Café",
    phone: "+57 300 123 4567",
    status: "ACTIVE",
    createdAt: "2026-04-01T10:00:00.000Z",
    _count: { quotes: 3 },
  },
  {
    id: "client-2",
    name: "Bernardo Quintero",
    email: null,
    company: "Aceros Andinos",
    phone: null,
    status: "ACTIVE",
    createdAt: "2026-04-02T14:30:00.000Z",
    _count: { quotes: 5 },
  },
];

const updatedClient: Client = {
  ...seedClients[0],
  name: "Alejandra R. (renamed)",
  email: "new@example.com",
};

beforeEach(() => {
  updateClientMock.mockReset();
  toastMock.mockReset();
});

describe("useUpdateClient", () => {
  it("calls updateClient with the id and payload", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    updateClientMock.mockResolvedValueOnce(updatedClient);

    const { result } = renderHook(() => useUpdateClient(), {
      wrapper: wrap(client),
    });

    const payload = { name: "Alejandra R. (renamed)", email: "new@example.com" };

    await act(async () => {
      await result.current.mutateAsync({ id: "client-1", payload });
    });

    expect(updateClientMock).toHaveBeenCalledWith("client-1", payload);
  });

  it("replaces the matching client in cache on success", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    client.setQueryData<Client[]>(["clients"], seedClients);
    updateClientMock.mockResolvedValueOnce(updatedClient);

    const { result } = renderHook(() => useUpdateClient(), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: "client-1",
        payload: { name: "Alejandra R. (renamed)", email: "new@example.com" },
      });
    });

    const cached = client.getQueryData<Client[]>(["clients"]);
    expect(cached).toEqual([updatedClient, seedClients[1]]);
  });

  it("shows success toast on success", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    updateClientMock.mockResolvedValueOnce(updatedClient);

    const { result } = renderHook(() => useUpdateClient(), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: "client-1",
        payload: { name: "Alejandra R. (renamed)" },
      });
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Cliente actualizado",
        variant: "success",
      });
    });
  });

  it("shows destructive toast on error", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    updateClientMock.mockRejectedValueOnce(new Error("Boom"));

    const { result } = renderHook(() => useUpdateClient(), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ id: "client-1", payload: { name: "X" } })
        .catch(() => {
          // expected
        });
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Error al actualizar cliente",
        variant: "destructive",
      });
    });
  });
});
