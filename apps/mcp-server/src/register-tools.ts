import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFaqSearchTool } from "./tools/faq-search.ts";
import { registerProcessQuoteTool } from "./tools/process-quote.ts";

export const registerTools = (server: McpServer) => {
  registerFaqSearchTool(server);
  registerProcessQuoteTool(server);
};
