import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFaqSearchTool } from "./faq-search";
import { registerProcessQuoteTool } from "./process-quote";

export const registerTools = (server: McpServer) => {
  registerFaqSearchTool(server);
  registerProcessQuoteTool(server);
};
