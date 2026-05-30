import { KnowledgeBaseUnavailableError } from "@/modules/orchestrator/domain/errors";
import type {
	AgentName,
	KnowledgeBasePort,
	SystemPromptArgs,
} from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import type { McpClient } from "./mcp-client.port";

const FAQ_CATALOG_URI = "faq://catalog";
const SYSTEM_PROMPT_NAME = "customer_service";
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Maps an internal agent name to the MCP prompt name registered by
 * `apps/mcp-server/src/register-prompts.ts`. Keep this in sync with that file.
 */
const AGENT_PROMPT_NAME: Record<AgentName, string> = {
	faq: "faq_agent",
	quotation: "quotation_agent",
};

export interface McpKnowledgeBaseAdapterDeps {
	now?: () => number;
}

export class McpKnowledgeBaseAdapter implements KnowledgeBasePort {
	private cache: { value: string; expiresAt: number } | null = null;
	private readonly now: () => number;

	constructor(
		private readonly mcp: McpClient,
		deps: McpKnowledgeBaseAdapterDeps = {},
	) {
		this.now = deps.now ?? (() => Date.now());
	}

	async getFaqCatalog(): Promise<
		Result<string, KnowledgeBaseUnavailableError>
	> {
		const now = this.now();
		if (this.cache && now < this.cache.expiresAt) {
			return ok(this.cache.value);
		}

		let value: string;
		try {
			value = await this.mcp.readResource(FAQ_CATALOG_URI);
		} catch (cause) {
			return err(new KnowledgeBaseUnavailableError("getFaqCatalog", cause));
		}

		// Cache only successful reads — never cache an error.
		this.cache = { value, expiresAt: now + CATALOG_CACHE_TTL_MS };
		return ok(value);
	}

	async getSystemPrompt(
		args: SystemPromptArgs,
	): Promise<Result<string, KnowledgeBaseUnavailableError>> {
		return this.fetchPrompt(SYSTEM_PROMPT_NAME, args, "getSystemPrompt");
	}

	async getAgentSystemPrompt(
		agent: AgentName,
		args: SystemPromptArgs,
	): Promise<Result<string, KnowledgeBaseUnavailableError>> {
		const promptName = AGENT_PROMPT_NAME[agent];
		// Op name carries the agent so logs at the caller can distinguish failures.
		return this.fetchPrompt(promptName, args, `getAgentSystemPrompt:${agent}`);
	}

	private async fetchPrompt(
		promptName: string,
		args: SystemPromptArgs,
		operation: string,
	): Promise<Result<string, KnowledgeBaseUnavailableError>> {
		const promptArgs: Record<string, string> = { context: args.context };
		if (args.habeasDataConsent === true) {
			promptArgs.habeas_data_consent = "true";
		} else if (args.habeasDataConsent === false) {
			promptArgs.habeas_data_consent = "false";
		}

		try {
			const value = await this.mcp.getPrompt(promptName, promptArgs);
			return ok(value);
		} catch (cause) {
			return err(new KnowledgeBaseUnavailableError(operation, cause));
		}
	}
}
