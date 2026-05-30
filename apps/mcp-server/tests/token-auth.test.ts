import { describe, it, expect } from "bun:test";
import { parseEnv } from "../src/core/config/env-schema.ts";

const VALID_ENV: Record<string, string> = {
  MCP_SERVER_PORT: "8000",
  PROJECT_NAME: "sidoc-ai-agentic",
  MCP_INTERNAL_TOKEN: "a".repeat(32),
};

describe("MCP_INTERNAL_TOKEN env validation", () => {
  it("accepts a token of 32+ characters", () => {
    const result = parseEnv(VALID_ENV);
    expect(result.MCP_INTERNAL_TOKEN).toBe("a".repeat(32));
  });

  it("throws when MCP_INTERNAL_TOKEN is missing", () => {
    const { MCP_INTERNAL_TOKEN: _, ...withoutToken } = VALID_ENV;
    expect(() => parseEnv(withoutToken)).toThrow();
  });

  it("throws when MCP_INTERNAL_TOKEN is shorter than 32 chars", () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, MCP_INTERNAL_TOKEN: "short" }),
    ).toThrow();
  });
});

describe("X-Internal-Token header validation", () => {
  const VALID_TOKEN = "a".repeat(32);

  const validateToken = (
    req: Request,
    expectedToken: string,
  ): Response | null => {
    const url = new URL(req.url);
    if (url.pathname === "/health") return null;

    const token = req.headers.get("X-Internal-Token");
    if (!token || token !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return null;
  };

  it("returns null (pass) for /health without token", () => {
    const req = new Request("http://localhost:8000/health");
    expect(validateToken(req, VALID_TOKEN)).toBeNull();
  });

  it("returns 401 for /mcp without token", () => {
    const req = new Request("http://localhost:8000/mcp", { method: "POST" });
    const res = validateToken(req, VALID_TOKEN);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns 401 for /mcp with wrong token", () => {
    const req = new Request("http://localhost:8000/mcp", {
      method: "POST",
      headers: { "X-Internal-Token": "wrong-token" },
    });
    const res = validateToken(req, VALID_TOKEN);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns null (pass) for /mcp with correct token", () => {
    const req = new Request("http://localhost:8000/mcp", {
      method: "POST",
      headers: { "X-Internal-Token": VALID_TOKEN },
    });
    expect(validateToken(req, VALID_TOKEN)).toBeNull();
  });
});
