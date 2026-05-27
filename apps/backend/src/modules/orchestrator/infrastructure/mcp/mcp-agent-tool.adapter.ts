import { ToolInvocationError } from "@/modules/orchestrator/domain/errors";
import type { AgentToolPort } from "@/modules/orchestrator/domain/ports/agent-tool.port";

import type { McpClient } from "./mcp-client.port";

export class McpAgentToolAdapter implements AgentToolPort {
  constructor(private readonly mcp: McpClient) {}

  async invoke(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    try {
      return await this.mcp.callTool(name, args);
    } catch (err) {
      throw new ToolInvocationError(name, err);
    }
  }
}
