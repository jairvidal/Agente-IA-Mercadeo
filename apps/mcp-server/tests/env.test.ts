import { describe, it, expect } from "bun:test";
import { parseEnv } from "../src/env-schema.ts";

const VALID_ENV: Record<string, string> = {
  MCP_SERVER_PORT: "8000",
  PROJECT_NAME: "sidoc-ai-agentic",
  MCP_INTERNAL_TOKEN: "a".repeat(32),
};

describe("mcp-server env validation", () => {
  it("exports parseEnv function", () => {
    expect(typeof parseEnv).toBe("function");
  });

  it("returns valid env object when all required vars are set", () => {
    const result = parseEnv(VALID_ENV);
    expect(result.MCP_SERVER_PORT).toBe(8000);
    expect(result.PROJECT_NAME).toBe("sidoc-ai-agentic");
  });

  it("throws when MCP_SERVER_PORT is missing", () => {
    expect(() => parseEnv({ PROJECT_NAME: "sidoc" })).toThrow();
  });

  it("throws when PROJECT_NAME is missing", () => {
    expect(() => parseEnv({ MCP_SERVER_PORT: "8000" })).toThrow();
  });

  it("throws when MCP_SERVER_PORT is not numeric", () => {
    expect(() => parseEnv({ ...VALID_ENV, MCP_SERVER_PORT: "abc" })).toThrow();
  });
});
