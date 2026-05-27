import { describe, it, expect } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTemplateTool } from "../src/tools/_template-tool.ts";

describe("template_tool", () => {
  it("registers without errors", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    expect(() => registerTemplateTool(server)).not.toThrow();
  });
});
