import { KnowledgeBaseUnavailableError } from "@/modules/orchestrator/domain/errors";
import type {
	KnowledgeBasePort,
	SystemPromptArgs,
} from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import type { McpClient } from "./mcp-client.port";

const FAQ_CATALOG_URI = "faq://catalog";
const SYSTEM_PROMPT_NAME = "customer_service";
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

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
		const promptArgs: Record<string, string> = { context: args.context };
		if (args.habeasDataConsent === true) {
			promptArgs.habeas_data_consent = "true";
		} else if (args.habeasDataConsent === false) {
			promptArgs.habeas_data_consent = "false";
		}

		try {
			const value = await this.mcp.getPrompt(SYSTEM_PROMPT_NAME, promptArgs);
			return ok(value);
		} catch (cause) {
			return err(new KnowledgeBaseUnavailableError("getSystemPrompt", cause));
		}
	}
}
