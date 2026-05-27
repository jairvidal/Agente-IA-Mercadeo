import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const registerTemplateResource = (server: McpServer) => {
  server.resource(
    "template://info",
    "template://info",
    { mimeType: "text/plain" },
    async () => ({
      contents: [
        {
          uri: "template://info",
          mimeType: "text/plain",
          text: "This is a template resource. Replace with your domain data.",
        },
      ],
    })
  );
};
