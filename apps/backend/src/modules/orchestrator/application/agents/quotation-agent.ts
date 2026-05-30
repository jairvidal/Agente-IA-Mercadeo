import type { AgentReply } from "@/modules/orchestrator/domain/entities/agent-reply";
import type {
	KnowledgeBaseUnavailableError,
	LlmError,
} from "@/modules/orchestrator/domain/errors";
import type {
	AgentError,
	AgentPort,
	AgentRunContext,
} from "@/modules/orchestrator/domain/ports/agent.port";
import type { AgentToolPort } from "@/modules/orchestrator/domain/ports/agent-tool.port";
import type {
	AgentName,
	KnowledgeBasePort,
} from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import type { LlmProviderPort } from "@/modules/orchestrator/domain/ports/llm-provider.port";
import { err, type Result } from "@/modules/orchestrator/domain/result";
import { logger } from "@sidoc/observability";

import { BaseAgent } from "./base-agent";

export interface QuotationAgentDeps {
	llm: LlmProviderPort;
	agentTools: AgentToolPort;
	knowledgeBase: KnowledgeBasePort;
	allowedTools: ReadonlySet<string>;
	maxIterations?: number;
}

/**
 * Specialized agent for "commercial_quotation" turns.
 *
 * Same shape as `FaqAgent` but resolves the `quotation_agent` MCP prompt. The
 * agent still consumes the FAQ catalog for product / city consistency, even
 * though its tool allowlist is `process_quote` only.
 */
export class QuotationAgent extends BaseAgent implements AgentPort {
	readonly name: AgentName = "quotation";
	protected readonly allowedTools: ReadonlySet<string>;
	private readonly knowledgeBase: KnowledgeBasePort;

	constructor(deps: QuotationAgentDeps) {
		super({
			llm: deps.llm,
			agentTools: deps.agentTools,
			maxIterations: deps.maxIterations,
		});
		this.knowledgeBase = deps.knowledgeBase;
		this.allowedTools = deps.allowedTools;
	}

	async run(ctx: AgentRunContext): Promise<Result<AgentReply, AgentError>> {
		const catalogResult = await this.knowledgeBase.getFaqCatalog();
		if (!catalogResult.ok) {
			logger.error(
				`[${this.name}-agent] Failed to retrieve FAQ catalog: ${JSON.stringify(catalogResult.error)}`,
			);
			return err<KnowledgeBaseUnavailableError>(catalogResult.error);
		}

		const promptResult = await this.knowledgeBase.getAgentSystemPrompt(
			this.name,
			{ context: catalogResult.value },
		);
		if (!promptResult.ok) {
			logger.error(
				`[${this.name}-agent] Failed to retrieve system prompt: ${JSON.stringify(promptResult.error)}`,
			);
			return err<KnowledgeBaseUnavailableError>(promptResult.error);
		}

		const loopResult: Result<AgentReply, LlmError> = await this.executeLoop(
			promptResult.value,
			ctx.history,
			ctx.message.text,
		);
		return loopResult;
	}
}
