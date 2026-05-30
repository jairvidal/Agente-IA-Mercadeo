import { describe, it, expect } from "bun:test";
import { buildQuotationAgentPrompt } from "../src/prompts/quotation-agent.ts";

describe("buildQuotationAgentPrompt", () => {
  it("contains Sidoc identity", () => {
    expect(buildQuotationAgentPrompt()).toContain("Sidoc S.A.");
  });

  it("declares quotation as its scope", () => {
    const result = buildQuotationAgentPrompt();
    expect(result.toLowerCase()).toContain("cotizaci");
  });

  it("does NOT classify intention (router already resolved it)", () => {
    const result = buildQuotationAgentPrompt();
    expect(result).not.toContain("INTENT: faq");
    expect(result).not.toContain("INTENT: quote_request");
  });

  it("injects FAQ context when provided", () => {
    expect(buildQuotationAgentPrompt("CONTEXTO_DE_PRUEBA")).toContain(
      "CONTEXTO FAQ:\nCONTEXTO_DE_PRUEBA",
    );
  });

  it("no FAQ context section when context is empty", () => {
    expect(buildQuotationAgentPrompt("")).not.toContain("CONTEXTO FAQ:\n");
  });

  it("habeasDataConsent=true exposes process_quote and step-by-step collection", () => {
    const result = buildQuotationAgentPrompt("", true);
    expect(result).toContain("HABEAS DATA ACEPTADO");
    expect(result).toContain("process_quote");
    expect(result).toMatch(/UNO POR UNO/);
  });

  it("habeasDataConsent=false forbids process_quote and asks for consent first", () => {
    const result = buildQuotationAgentPrompt("", false);
    expect(result).toContain("CONSENTIMIENTO PENDIENTE");
    expect(result).toMatch(/NO invoques.*process_quote/);
    expect(result).not.toContain("HABEAS DATA ACEPTADO");
  });

  it("undefined consent behaves like consent pending", () => {
    expect(buildQuotationAgentPrompt()).toContain("CONSENTIMIENTO PENDIENTE");
    expect(buildQuotationAgentPrompt()).toMatch(/NO invoques.*process_quote/);
  });
});
