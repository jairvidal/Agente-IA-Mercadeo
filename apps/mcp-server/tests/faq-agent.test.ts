import { describe, it, expect } from "bun:test";
import { buildFaqAgentPrompt } from "../src/prompts/faq-agent.ts";

describe("buildFaqAgentPrompt", () => {
  it("contains Sidoc identity", () => {
    expect(buildFaqAgentPrompt()).toContain("Sidoc S.A.");
  });

  it("declares FAQ as its scope", () => {
    const result = buildFaqAgentPrompt();
    expect(result.toLowerCase()).toContain("faq");
    expect(result.toLowerCase()).toMatch(/preguntas frecuentes|informativ/);
  });

  it("does NOT classify intention (router already resolved it)", () => {
    const result = buildFaqAgentPrompt();
    expect(result).not.toContain("INTENT: faq");
    expect(result).not.toContain("INTENT: quote_request");
  });

  it("exposes only search_faq and explicitly forbids process_quote", () => {
    const result = buildFaqAgentPrompt();
    expect(result).toContain("search_faq");
    expect(result).toMatch(/NO invoques.*process_quote/);
  });

  it("injects FAQ context when provided", () => {
    expect(buildFaqAgentPrompt("CONTEXTO_DE_PRUEBA")).toContain(
      "CONTEXTO FAQ:\nCONTEXTO_DE_PRUEBA",
    );
  });

  it("no FAQ context section when context is empty", () => {
    expect(buildFaqAgentPrompt("")).not.toContain("CONTEXTO FAQ:\n");
  });

  it("with habeasDataConsent=true still routes quotations away", () => {
    const result = buildFaqAgentPrompt("", true);
    // Even with consent, FAQ agent does not process quotes.
    expect(result).toContain("NOTA HABEAS DATA");
    expect(result).toMatch(/NO invoques.*process_quote/);
  });

  it("with habeasDataConsent=false / undefined still forbids process_quote", () => {
    expect(buildFaqAgentPrompt("", false)).toMatch(
      /NO invoques.*process_quote/,
    );
    expect(buildFaqAgentPrompt()).toMatch(/NO invoques.*process_quote/);
  });
});
