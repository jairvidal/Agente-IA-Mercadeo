import type { KnowledgeBaseUnavailableError } from "@/modules/orchestrator/domain/errors";
import type { Result } from "@/modules/orchestrator/domain/result";

export interface SystemPromptArgs {
	context: string;
	habeasDataConsent?: boolean;
}

/**
 * Identifier of a specialized agent in the multi-agent network. Used by the
 * `KnowledgeBasePort` to resolve the right system prompt and by the
 * `AgentRegistry` to map a classified category to an agent.
 *
 * Kept here (not in `entities/`) because the port surface needs the literal
 * union and we want the import direction `port -> entity` to remain forbidden.
 */
export type AgentName = "faq" | "quotation";

export interface KnowledgeBasePort {
	getFaqCatalog(): Promise<Result<string, KnowledgeBaseUnavailableError>>;
	getSystemPrompt(
		args: SystemPromptArgs,
	): Promise<Result<string, KnowledgeBaseUnavailableError>>;
	/**
	 * Resolves the system prompt for a specialized agent (FAQ or Quotation).
	 * Backed by the MCP server prompts `faq_agent` and `quotation_agent`.
	 */
	getAgentSystemPrompt(
		agent: AgentName,
		args: SystemPromptArgs,
	): Promise<Result<string, KnowledgeBaseUnavailableError>>;
}
