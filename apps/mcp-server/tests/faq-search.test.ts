import { describe, it, expect, mock, beforeEach } from "bun:test";
import { FAQ_DATA } from "./fixtures.ts";

mock.module("fs", () => ({
  readFileSync: () => JSON.stringify(FAQ_DATA),
}));

const { searchFaq } = await import("../src/tools/faq-search.ts");

describe("searchFaq", () => {
  it("empty query returns prompt message", () => {
    const result = searchFaq("");
    expect(result).toContain("Por favor");
  });

  it("whitespace-only query returns prompt message", () => {
    expect(searchFaq("   ")).toContain("Por favor");
  });

  it("city name in query returns matching store", () => {
    const result = searchFaq("tienda en cali");
    expect(result).toContain("Sidoc Santa Elena");
    expect(result).toContain("Cali");
  });

  it("store name in query returns matching store", () => {
    const result = searchFaq("sidoc acopi");
    expect(result).toContain("Sidoc Acopi");
  });

  it("service keyword returns matching service", () => {
    const result = searchFaq("servicio de corte");
    expect(result).toContain("Acero Figurado");
  });

  it("FAQ keyword match returns FAQ entry", () => {
    const result = searchFaq("horario de atencion");
    expect(result).toContain("horario");
  });

  it("unrecognized query returns fallback with all info", () => {
    const result = searchFaq("información completamente desconocida xyz123");
    expect(result).toContain("No encontré una respuesta exacta");
    expect(result).toContain("Sidoc");
  });
});
