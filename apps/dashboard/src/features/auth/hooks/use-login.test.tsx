import type { ReactNode } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";

const postMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
      post: (...args: unknown[]) => postMock(...args),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

import { useLogin } from "./use-login";

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useLogin", () => {
  beforeEach(() => {
    postMock.mockReset();
    navigateMock.mockReset();
  });

  it("navigates to /dashboard and invalidates session on success", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    postMock.mockResolvedValueOnce({});

    const { result } = renderHook(() => useLogin(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.submit({ email: "user@sidoc.co", password: "secret" });
    });

    expect(postMock).toHaveBeenCalledWith("/auth/login", {
      email: "user@sidoc.co",
      password: "secret",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["session"] });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/dashboard" });
    expect(result.current.formError).toBeNull();
  });

  it("exposes credential error on 401", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    postMock.mockRejectedValueOnce(new ApiError(401, "Unauthorized"));

    const { result } = renderHook(() => useLogin(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.submit({ email: "user@sidoc.co", password: "wrong" });
    });

    await waitFor(() =>
      expect(result.current.formError).toBe(
        "Credenciales inválidas. Verifica tu email y contraseña.",
      ),
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("exposes generic error on non-401 failures", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    postMock.mockRejectedValueOnce(new ApiError(500, "Boom"));

    const { result } = renderHook(() => useLogin(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.submit({ email: "user@sidoc.co", password: "secret" });
    });

    await waitFor(() =>
      expect(result.current.formError).toBe("No pudimos iniciar sesión. Intenta de nuevo."),
    );
  });

  it("clears formError when a new submit starts", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    postMock.mockRejectedValueOnce(new ApiError(401, "Unauthorized"));

    const { result } = renderHook(() => useLogin(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.submit({ email: "user@sidoc.co", password: "wrong" });
    });
    await waitFor(() => expect(result.current.formError).not.toBeNull());

    postMock.mockResolvedValueOnce({});
    await act(async () => {
      await result.current.submit({ email: "user@sidoc.co", password: "secret" });
    });

    expect(result.current.formError).toBeNull();
  });
});
