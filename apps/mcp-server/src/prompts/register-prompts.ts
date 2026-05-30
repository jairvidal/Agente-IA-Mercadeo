import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCustomerServicePrompt } from "../prompts/customer-service.ts";
import { registerFaqAgentPrompt } from "../prompts/faq-agent.ts";
import { registerQuotationAgentPrompt } from "../prompts/quotation-agent.ts";

export const registerPrompts = (server: McpServer) => {
  registerCustomerServicePrompt(server);
  registerFaqAgentPrompt(server);
  registerQuotationAgentPrompt(server);
};
