import type { ToolInvocationError } from "@/modules/orchestrator/domain/errors";
import type { Result } from "@/modules/orchestrator/domain/result";

export interface AgentToolPort {
	invoke(
		name: string,
		args: Record<string, unknown>,
	): Promise<Result<string, ToolInvocationError>>;
}
