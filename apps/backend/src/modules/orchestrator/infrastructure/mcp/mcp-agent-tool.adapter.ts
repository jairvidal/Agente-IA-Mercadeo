import { ToolInvocationError } from "@/modules/orchestrator/domain/errors";
import type { AgentToolPort } from "@/modules/orchestrator/domain/ports/agent-tool.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import type { McpClient } from "./mcp-client.port";

export class McpAgentToolAdapter implements AgentToolPort {
	constructor(private readonly mcp: McpClient) {}

	async invoke(
		name: string,
		args: Record<string, unknown>,
	): Promise<Result<string, ToolInvocationError>> {
		try {
			const value = await this.mcp.callTool(name, args);
			return ok(value);
		} catch (cause) {
			return err(new ToolInvocationError(name, cause));
		}
	}
}
