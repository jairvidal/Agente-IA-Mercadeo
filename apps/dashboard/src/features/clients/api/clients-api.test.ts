import { beforeEach, describe, expect, it } from "vitest";

import {
  createClient,
  deleteClient,
  fetchClientById,
  fetchClients,
  resetMockState,
  updateClient,
} from "./clients-api";

beforeEach(() => {
  resetMockState();
});

describe("fetchClients", () => {
  it("returns the full seed of 18 clients", async () => {
    const result = await fetchClients();
    expect(result).toHaveLength(18);
  });
});

describe("fetchClientById", () => {
  it("returns the matching client when id exists", async () => {
    const result = await fetchClientById("client-1");
    expect(result.id).toBe("client-1");
    expect(result.name).toBe("Alejandra Restrepo");
  });

  it("throws when id is unknown", async () => {
    await expect(fetchClientById("does-not-exist")).rejects.toThrow();
  });
});

describe("createClient", () => {
  it("adds a new client to the state with a generated id", async () => {
    const before = await fetchClients();
    const created = await createClient({
      name: "Test User",
      email: "test@example.com",
      company: "Test Co",
      phone: "+57 300 000 0000",
    });
    expect(created.id).toBeTruthy();
    expect(created.id).not.toBe("client-1");
    expect(created.status).toBe("ACTIVE");
    expect(created._count.quotes).toBe(0);

    const after = await fetchClients();
    expect(after).toHaveLength(before.length + 1);
    expect(after.find((c) => c.id === created.id)).toBeDefined();
  });

  it("generates unique IDs across consecutive calls", async () => {
    const a = await createClient({ name: "A", email: "", company: "", phone: "" });
    const b = await createClient({ name: "B", email: "", company: "", phone: "" });
    const c = await createClient({ name: "C", email: "", company: "", phone: "" });
    const ids = new Set([a.id, b.id, c.id]);
    expect(ids.size).toBe(3);
  });

  it("converts empty strings to null for email, company, and phone", async () => {
    const created = await createClient({
      name: "Solo Name",
      email: "",
      company: "",
      phone: "",
    });
    expect(created.email).toBeNull();
    expect(created.company).toBeNull();
    expect(created.phone).toBeNull();
  });
});

describe("updateClient", () => {
  it("modifies only the target client", async () => {
    const before = await fetchClients();
    const updated = await updateClient("client-1", { name: "Renamed Client" });
    expect(updated.name).toBe("Renamed Client");
    expect(updated.id).toBe("client-1");

    const after = await fetchClients();
    const othersBefore = before.filter((c) => c.id !== "client-1");
    const othersAfter = after.filter((c) => c.id !== "client-1");
    expect(othersAfter).toEqual(othersBefore);
  });

  it("throws when id is unknown", async () => {
    await expect(updateClient("nope", { name: "X" })).rejects.toThrow();
  });
});

describe("deleteClient", () => {
  it("removes the target client from the state", async () => {
    await deleteClient("client-1");
    const after = await fetchClients();
    expect(after).toHaveLength(17);
    expect(after.find((c) => c.id === "client-1")).toBeUndefined();
  });

  it("throws when id is unknown", async () => {
    await expect(deleteClient("does-not-exist")).rejects.toThrow();
  });
});
