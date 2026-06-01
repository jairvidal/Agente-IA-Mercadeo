import { describe, expect, it } from "vitest";

import type { Client } from "../schemas/client-schema";

import { searchClients } from "./search-clients";

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-test",
    name: "Test User",
    email: "test@example.com",
    company: "Test Co",
    phone: "+57 300 000 0000",
    status: "ACTIVE",
    createdAt: "2026-05-01T10:00:00.000Z",
    _count: { quotes: 0 },
    ...overrides,
  };
}

const seed: Client[] = [
  makeClient({
    id: "c-1",
    name: "Alejandra Restrepo",
    email: "alejandra@example.com",
    company: "Inmobiliaria del Café",
  }),
  makeClient({
    id: "c-2",
    name: "Bernardo Quintero",
    email: "bernardo@aceros-andinos.co",
    company: "Aceros Andinos",
  }),
  makeClient({
    id: "c-3",
    name: "Camila Ñungo",
    email: null,
    company: "Constructora Ñandú",
  }),
  makeClient({
    id: "c-4",
    name: "Daniela Torres",
    email: "dani@outlook.com",
    company: null,
  }),
];

describe("searchClients", () => {
  it("returns all clients when query is empty", () => {
    expect(searchClients(seed, "")).toEqual(seed);
  });

  it("matches case-insensitively", () => {
    const result = searchClients(seed, "ALEJANDRA");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c-1");
  });

  it("matches diacritic-insensitively (Cafe matches Café, Nungo matches Ñungo)", () => {
    const cafeResult = searchClients(seed, "Cafe");
    expect(cafeResult).toHaveLength(1);
    expect(cafeResult[0].id).toBe("c-1");

    const nungoResult = searchClients(seed, "Nungo");
    expect(nungoResult).toHaveLength(1);
    expect(nungoResult[0].id).toBe("c-3");
  });

  it("matches partial substrings (not just prefixes)", () => {
    const result = searchClients(seed, "restrepo");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c-1");
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchClients(seed, "zzz-no-match")).toEqual([]);
  });

  it("does not throw when company is null", () => {
    const result = searchClients(seed, "daniela");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c-4");
  });

  it("does not throw when email is null", () => {
    const result = searchClients(seed, "camila");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c-3");
  });

  it("trims leading and trailing whitespace from the query", () => {
    const result = searchClients(seed, "  alejandra  ");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c-1");
  });
});
