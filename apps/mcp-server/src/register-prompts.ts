import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCustomerServicePrompt } from "./prompts/customer-service.ts";

export const registerPrompts = (server: McpServer) => {
  registerCustomerServicePrompt(server);
};
