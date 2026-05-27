import { describe, it, expect } from "bun:test";
import { processQuote } from "../src/tools/process-quote.ts";

describe("processQuote", () => {
  it("returns ticket ID and success message", () => {
    const result = processQuote({
      product: "Varilla 1/2",
      quantity: 50,
      location: "Cali",
      contact_name: "Juan Pérez",
      company_name: "Constructora ABC",
    });
    expect(result).toContain("TICKET-");
    expect(result).toContain("asesor comercial");
  });

  it("ticket ID is unique per call", () => {
    const params = { product: "Platina", quantity: 10, location: "Cali", contact_name: "Ana", company_name: "X" };
    const r1 = processQuote(params);
    const r2 = processQuote(params);
    const id1 = r1.match(/TICKET-\w+/)?.[0];
    const id2 = r2.match(/TICKET-\w+/)?.[0];
    expect(id1).not.toBe(id2);
  });
});
