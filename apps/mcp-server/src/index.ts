import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { env } from "@/core/config/env";
import { registerPrompts } from "./prompts/register-prompts";
import { registerResources } from "./resources/register-resources";
import { registerTools } from "./tools/register-tools";

const PORT = env.MCP_SERVER_PORT;

// A fresh McpServer per session — registrations are cheap and keep sessions isolated.
const createServer = (): McpServer => {
  const server = new McpServer({
    name: env.PROJECT_NAME,
    version: "1.0.0",
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
};

// One transport per session, keyed by the `mcp-session-id` header.
// A stateful StreamableHTTP transport can only ever serve a single session,
// so each `initialize` request must get its own transport instance.
const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

const unauthorized = () =>
  Response.json({ error: "Unauthorized" }, { status: 401 });

const jsonRpcError = (status: number, code: number, message: string) =>
  Response.json(
    { jsonrpc: "2.0", error: { code, message }, id: null },
    { status },
  );

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json(
        {
          status: "ok",
          deps: { mcp: "ok" },
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404 });
    }

    const token = req.headers.get("X-Internal-Token");
    if (!token || token !== env.MCP_INTERNAL_TOKEN) {
      return unauthorized();
    }

    const sessionId = req.headers.get("mcp-session-id");

    // Existing session: route to its transport.
    if (sessionId) {
      const existing = transports.get(sessionId);
      if (!existing) {
        return jsonRpcError(404, -32001, "Session not found");
      }
      return existing.handleRequest(req);
    }

    // No session id: must be an `initialize` request. Peek the body (cloned,
    // so the original stream is still consumable by handleRequest).
    let body: unknown = null;
    try {
      body = await req.clone().json();
    } catch {
      body = null;
    }

    const isInit = Array.isArray(body)
      ? body.some(isInitializeRequest)
      : isInitializeRequest(body);

    if (!isInit) {
      return jsonRpcError(
        400,
        -32000,
        "Bad Request: No valid session ID provided",
      );
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      },
      onsessionclosed: (id) => {
        transports.delete(id);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId);
    };

    const server = createServer();
    await server.connect(transport);

    return transport.handleRequest(req);
  },
});

console.log(`MCP Server running on port ${PORT}`);
