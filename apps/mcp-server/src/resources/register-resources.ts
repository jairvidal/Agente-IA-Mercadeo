import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFaqCatalogResource } from "./faq-catalog.ts";

export const registerResources = (server: McpServer) => {
  registerFaqCatalogResource(server);
};
