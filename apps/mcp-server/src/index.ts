import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { env } from "@/env";
import { registerPrompts } from "@/register-prompts";
import { registerResources } from "@/register-resources";
import { registerTools } from "@/register-tools";

const PORT = env.MCP_SERVER_PORT;

const server = new McpServer({
  name: env.PROJECT_NAME,
  version: "1.0.0",
});

registerTools(server);
registerResources(server);
registerPrompts(server);

const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

await server.connect(transport);

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      const connected = server.isConnected?.() ?? true;
      if (!connected) {
        return Response.json(
          { status: "degraded", deps: { mcp: "error" }, timestamp: new Date().toISOString() },
          { status: 503 },
        );
      }
      return Response.json(
        { status: "ok", deps: { mcp: "ok" }, timestamp: new Date().toISOString() },
        { status: 200 },
      );
    }

    if (url.pathname === "/mcp") {
      const token = req.headers.get("X-Internal-Token");
      if (!token || token !== env.MCP_INTERNAL_TOKEN) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return transport.handleRequest(req);
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`MCP Server running on port ${PORT}`);
