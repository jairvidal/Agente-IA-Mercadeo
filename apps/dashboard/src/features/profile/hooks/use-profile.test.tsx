import type { ReactNode } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchProfileMock = vi.fn();
const updateProfileMock = vi.fn();

vi.mock("../api/profile-api", () => ({
  fetchProfile: (...args: unknown[]) => fetchProfileMock(...args),
  updateProfile: (...args: unknown[]) => updateProfileMock(...args),
}));

import { useProfile, useUpdateProfile } from "./use-profile";

const validProfile = {
  id: "dev",
  email: "dev@sidoc.co",
  name: "Dev User",
  createdAt: "2026-01-15T10:00:00.000Z",
};

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("useProfile", () => {
  beforeEach(() => {
    fetchProfileMock.mockReset();
    updateProfileMock.mockReset();
  });

  it("returns profile data on success", async () => {
    const client = makeClient();
    fetchProfileMock.mockResolvedValueOnce(validProfile);

    const { result } = renderHook(() => useProfile(), { wrapper: wrap(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(validProfile);
  });

  it("surfaces errors when fetchProfile rejects", async () => {
    const client = makeClient();
    fetchProfileMock.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useProfile(), { wrapper: wrap(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateProfile", () => {
  beforeEach(() => {
    fetchProfileMock.mockReset();
    updateProfileMock.mockReset();
  });

  it("writes the server response to the profile cache on success", async () => {
    const client = makeClient();
    client.setQueryData(["profile"], validProfile);
    const updated = { ...validProfile, name: "Updated" };
    updateProfileMock.mockResolvedValueOnce(updated);

    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.mutateAsync({ name: "Updated" });
    });

    expect(client.getQueryData(["profile"])).toEqual(updated);
  });
});
