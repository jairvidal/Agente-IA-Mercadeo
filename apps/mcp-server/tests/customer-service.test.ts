import { describe, it, expect } from "bun:test";
import { buildCustomerServicePrompt } from "../src/prompts/customer-service.ts";

describe("buildCustomerServicePrompt", () => {
  it("contains Sidoc identity", () => {
    expect(buildCustomerServicePrompt()).toContain("Sidoc S.A.");
  });

  it("contains INTENT classification instructions", () => {
    const result = buildCustomerServicePrompt();
    expect(result).toContain("INTENT: faq");
    expect(result).toContain("INTENT: quote_request");
  });

  it("does not include MENSAJE DEL USUARIO section", () => {
    expect(buildCustomerServicePrompt()).not.toContain("MENSAJE DEL USUARIO");
  });

  it("injects FAQ context when provided", () => {
    expect(buildCustomerServicePrompt("CONTEXTO_DE_PRUEBA")).toContain("CONTEXTO FAQ:\nCONTEXTO_DE_PRUEBA");
  });

  it("no FAQ context section when context is empty", () => {
    expect(buildCustomerServicePrompt("")).not.toContain("CONTEXTO FAQ:\n");
  });

  it("habeas_data_consent=true includes process_quote tool and collection instructions", () => {
    const result = buildCustomerServicePrompt("", true);
    expect(result).toContain("HABEAS DATA ACEPTADO");
    expect(result).toContain("process_quote");
    expect(result).toContain("HERRAMIENTAS PERMITIDAS");
  });

  it("habeas_data_consent=false includes only search_faq tool and restriction instructions", () => {
    const result = buildCustomerServicePrompt("", false);
    expect(result).toContain("REGLA COMERCIAL CRÍTICA");
    expect(result).toContain("search_faq");
    expect(result).not.toContain("HABEAS DATA ACEPTADO");
  });

  it("undefined consent includes restriction instructions", () => {
    expect(buildCustomerServicePrompt()).toContain("REGLA COMERCIAL CRÍTICA");
  });
});
