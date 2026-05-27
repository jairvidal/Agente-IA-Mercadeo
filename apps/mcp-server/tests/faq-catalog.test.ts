import { describe, it, expect, mock } from "bun:test";
import { FAQ_DATA } from "./fixtures.ts";

mock.module("fs", () => ({
  readFileSync: () => JSON.stringify(FAQ_DATA),
}));

const { getFaqCatalog } = await import("../src/resources/faq-catalog.ts");

describe("getFaqCatalog", () => {
  it("returns company header", () => {
    const result = getFaqCatalog();
    expect(result).toContain("Siderúrgica Del Occidente");
  });

  it("returns tiendas section", () => {
    const result = getFaqCatalog();
    expect(result).toContain("--- Tiendas ---");
    expect(result).toContain("Sidoc Santa Elena");
  });

  it("returns servicios section", () => {
    const result = getFaqCatalog();
    expect(result).toContain("--- Servicios ---");
    expect(result).toContain("Acero Figurado");
  });

  it("returns FAQ section", () => {
    const result = getFaqCatalog();
    expect(result).toContain("--- Preguntas Frecuentes ---");
    expect(result).toContain("horario");
  });

  it("result is a string", () => {
    expect(typeof getFaqCatalog()).toBe("string");
  });

  it("result is not empty", () => {
    expect(getFaqCatalog().length).toBeGreaterThan(0);
  });
});
