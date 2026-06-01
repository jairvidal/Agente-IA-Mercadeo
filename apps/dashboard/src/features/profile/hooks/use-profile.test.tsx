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
import type { Profile } from "../schemas/profile-schema";

const validProfile: Profile = {
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

  it("writes the optimistic value to the cache before the mutation resolves", async () => {
    const client = makeClient();
    client.setQueryData(["profile"], validProfile);

    let resolveUpdate: (value: Profile) => void = () => {};
    updateProfileMock.mockImplementationOnce(
      () => new Promise<Profile>((resolve) => { resolveUpdate = resolve; }),
    );

    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrap(client) });

    act(() => {
      result.current.mutate({ name: "Optimistic" });
    });

    await waitFor(() => {
      expect(client.getQueryData<Profile>(["profile"])).toEqual({
        ...validProfile,
        name: "Optimistic",
      });
    });
    expect(updateProfileMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveUpdate({ ...validProfile, name: "Optimistic" });
    });
  });

  it("rolls back to the previous cache value when the mutation fails", async () => {
    const client = makeClient();
    client.setQueryData(["profile"], validProfile);
    updateProfileMock.mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrap(client) });

    await act(async () => {
      try {
        await result.current.mutateAsync({ name: "WillFail" });
      } catch {
        // expected
      }
    });

    expect(client.getQueryData<Profile>(["profile"])).toEqual(validProfile);
  });

  it("cancels in-flight profile queries before applying the optimistic update", async () => {
    const client = makeClient();
    client.setQueryData(["profile"], validProfile);
    const cancelSpy = vi.spyOn(client, "cancelQueries");
    updateProfileMock.mockResolvedValueOnce({ ...validProfile, name: "Updated" });

    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.mutateAsync({ name: "Updated" });
    });

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: ["profile"] });
  });

  it("reconciles cache with server value after successful mutation via invalidateQueries", async () => {
    const client = makeClient();
    const serverValue: Profile = { ...validProfile, name: "Server Truth" };
    fetchProfileMock
      .mockResolvedValueOnce(validProfile)
      .mockResolvedValueOnce(serverValue);
    updateProfileMock.mockResolvedValueOnce({ ...validProfile, name: "Optimistic" });

    const { result } = renderHook(
      () => ({ profile: useProfile(), mutation: useUpdateProfile() }),
      { wrapper: wrap(client) },
    );

    await waitFor(() => expect(result.current.profile.isSuccess).toBe(true));

    await act(async () => {
      await result.current.mutation.mutateAsync({ name: "Optimistic" });
    });

    await waitFor(() => {
      expect(result.current.profile.data).toEqual(serverValue);
    });
    expect(fetchProfileMock).toHaveBeenCalledTimes(2);
  });
});
