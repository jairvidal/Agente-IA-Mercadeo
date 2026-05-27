import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const TemplateInputSchema = z.object({
  input: z.string().describe("Input to echo back"),
});

export const registerTemplateTool = (server: McpServer) => {
  server.tool(
    "template_tool",
    "A template tool — replace with your domain logic",
    TemplateInputSchema.shape,
    async ({ input }) => ({
      content: [{ type: "text" as const, text: `Echo: ${input}` }],
    })
  );
};
