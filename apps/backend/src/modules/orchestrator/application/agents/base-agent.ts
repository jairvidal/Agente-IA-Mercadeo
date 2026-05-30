import type { AgentReply } from "@/modules/orchestrator/domain/entities/agent-reply";
import type { ConversationTurn } from "@/modules/orchestrator/domain/entities/session";
import {
	type LlmError,
	LlmInvalidResponseError,
	LlmRateLimitError,
	LlmTimeoutError,
} from "@/modules/orchestrator/domain/errors";
import type { AgentToolPort } from "@/modules/orchestrator/domain/ports/agent-tool.port";
import type { AgentName } from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import type {
	LlmMessage,
	LlmProviderPort,
	LlmToolCall,
} from "@/modules/orchestrator/domain/ports/llm-provider.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";
import { logger } from "@sidoc/observability";

import { MAX_AGENT_ITERATIONS } from "@/modules/orchestrator/domain/constants";

export interface BaseAgentDeps {
	llm: LlmProviderPort;
	agentTools: AgentToolPort;
	maxIterations?: number;
}

/**
 * Abstract agentic loop shared by `FaqAgent` and `QuotationAgent`.
 *
 * The loop is a byte-by-byte extraction of the previous `draftAgenticReply`:
 *   - assistant content + tool calls go in as one `assistant` message,
 *   - each tool result is appended as a `user` message prefixed with
 *     `[Tool result for X]` / `[Tool error for X]`,
 *   - `LlmTimeoutError` / `LlmRateLimitError` retry implicitly by continuing
 *     the loop iteration (capped at `maxIterations - 1`),
 *   - `LlmInvalidResponseError` short-circuits with no retry (schema bugs).
 *
 * Subclasses are responsible for producing the system prompt and the per-agent
 * tool allowlist. All errors bubble up — the use case decides whether to map
 * them to a fallback reply.
 */
export abstract class BaseAgent {
	abstract readonly name: AgentName;
	protected abstract readonly allowedTools: ReadonlySet<string>;

	protected readonly llm: LlmProviderPort;
	protected readonly agentTools: AgentToolPort;
	protected readonly maxIterations: number;

	protected constructor(deps: BaseAgentDeps) {
		this.llm = deps.llm;
		this.agentTools = deps.agentTools;
		this.maxIterations = deps.maxIterations ?? MAX_AGENT_ITERATIONS;
	}

	/**
	 * Runs the agentic loop with a pre-built system prompt + prior history +
	 * the current user message. Returns the assistant's final text response or
	 * an `LlmError` if the loop cannot resolve a reply.
	 */
	protected async executeLoop(
		systemPrompt: string,
		history: ConversationTurn[],
		userText: string,
	): Promise<Result<AgentReply, LlmError>> {
		const messages: LlmMessage[] = [
			{ role: "system", content: systemPrompt },
			...history.map((turn) => ({
				role: turn.role,
				content: turn.content,
			})),
			{ role: "user", content: userText },
		];

		for (let iteration = 0; iteration < this.maxIterations; iteration++) {
			const completionResult = await this.llm.complete({ messages });

			if (!completionResult.ok) {
				if (completionResult.error instanceof LlmInvalidResponseError) {
					// Schema mismatch / parse failure — almost always a bug. Don't retry.
					logger.error(
						`[${this.name}-agent] LLM returned an invalid response: ${JSON.stringify(
							completionResult.error,
						)}`,
					);
					return err(completionResult.error);
				}
				if (
					completionResult.error instanceof LlmTimeoutError ||
					completionResult.error instanceof LlmRateLimitError
				) {
					// Transient — retry by continuing the loop. If we're already on
					// the last iteration, fall through to the cap log + error.
					if (iteration < this.maxIterations - 1) continue;
				}
				logger.error(
					`[${this.name}-agent] LLM completion error: ${JSON.stringify(
						completionResult.error,
					)}`,
				);
				return err(completionResult.error);
			}

			const { content, toolCalls } = completionResult.value;
			const callsToExecute = (toolCalls ?? []).filter((tc) =>
				this.allowedTools.has(tc.name),
			);

			if (callsToExecute.length === 0) {
				return ok({
					text: content,
					metadata: { intent: "direct_response" },
				});
			}

			messages.push({ role: "assistant", content });
			for (const tc of callsToExecute) {
				await this.executeToolCall(tc, messages);
			}
		}

		logger.error(
			`[${this.name}-agent] LLM exceeded max iterations (${this.maxIterations})`,
		);
		return err(
			new LlmInvalidResponseError(
				`max_iterations_exceeded:${this.maxIterations}`,
			),
		);
	}

	private async executeToolCall(
		tc: LlmToolCall,
		messages: LlmMessage[],
	): Promise<void> {
		const toolResult = await this.agentTools.invoke(tc.name, tc.arguments);
		if (toolResult.ok) {
			messages.push({
				role: "user",
				content: `[Tool result for ${tc.name}]: ${toolResult.value}`,
			});
			return;
		}

		logger.error(
			`[${this.name}-agent] Error invoking tool ${tc.name}: ${JSON.stringify(
				toolResult.error,
			)}`,
		);

		messages.push({
			role: "user",
			content: `[Tool error for ${tc.name}]: ${toolResult.error.message}`,
		});
	}
}
