import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFaqCatalogResource } from "./resources/faq-catalog.ts";

export const registerResources = (server: McpServer) => {
  registerFaqCatalogResource(server);
};
