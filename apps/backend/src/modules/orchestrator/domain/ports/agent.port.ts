import type { AgentReply } from "@/modules/orchestrator/domain/entities/agent-reply";
import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { ConversationTurn } from "@/modules/orchestrator/domain/entities/session";
import type {
	KnowledgeBaseUnavailableError,
	LlmError,
} from "@/modules/orchestrator/domain/errors";
import type { AgentName } from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import type { Result } from "@/modules/orchestrator/domain/result";

export interface AgentRunContext {
	message: IncomingMessage;
	/**
	 * Conversation history BEFORE the current user turn. The agent is responsible
	 * for placing `message.text` at the end of the LLM message thread.
	 */
	history: ConversationTurn[];
}

export type AgentError = LlmError | KnowledgeBaseUnavailableError;

/**
 * Secondary port for "run one turn with a specialized agent". The use case
 * resolves the right agent via `AgentRegistry` and delegates execution.
 *
 * Implementations live in `application/agents/` and own their agentic loop +
 * tool allowlist. Errors are mapped to `AGENT_FALLBACK_REPLY` at the use-case
 * boundary, NOT here.
 */
export interface AgentPort {
	readonly name: AgentName;
	run(ctx: AgentRunContext): Promise<Result<AgentReply, AgentError>>;
}
