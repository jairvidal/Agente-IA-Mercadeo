import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteClientMock, toastMock } = vi.hoisted(() => ({
  deleteClientMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("../api/clients-api", async () => {
  const actual = await vi.importActual<typeof import("../api/clients-api")>(
    "../api/clients-api",
  );
  return {
    ...actual,
    deleteClient: deleteClientMock,
  };
});

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn() }),
}));

import { useDeleteClient } from "./use-delete-client";

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  deleteClientMock.mockReset();
  toastMock.mockReset();
});

describe("useDeleteClient", () => {
  it("calls deleteClient with the id", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    deleteClientMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteClient(), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync("client-1");
    });

    expect(deleteClientMock).toHaveBeenCalledWith("client-1");
  });

  it("invalidates clients query and shows success toast on success", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    deleteClientMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteClient(), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync("client-1");
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["clients"] });
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Cliente eliminado",
      variant: "success",
    });
  });

  it("shows destructive toast on error", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    deleteClientMock.mockRejectedValueOnce(new Error("Boom"));

    const { result } = renderHook(() => useDeleteClient(), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync("client-1").catch(() => {
        // expected
      });
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Error al eliminar cliente",
        variant: "destructive",
      });
    });
  });
});
