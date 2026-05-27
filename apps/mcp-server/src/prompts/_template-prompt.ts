import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const TemplatePromptSchema = z.object({
  context: z.string().optional().describe("Additional context to inject"),
});

export const registerTemplatePrompt = (server: McpServer) => {
  server.prompt(
    "template_prompt",
    "A template system prompt — replace with your domain persona",
    TemplatePromptSchema.shape,
    ({ context }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "You are a helpful assistant.",
              context ? `\nContext:\n${context}` : "",
            ].join(""),
          },
        },
      ],
    })
  );
};
