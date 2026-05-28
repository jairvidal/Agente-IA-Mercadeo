import type { KnowledgeBaseUnavailableError } from "@/modules/orchestrator/domain/errors";
import type { Result } from "@/modules/orchestrator/domain/result";

export interface SystemPromptArgs {
	context: string;
	habeasDataConsent?: boolean;
}

export interface KnowledgeBasePort {
	getFaqCatalog(): Promise<Result<string, KnowledgeBaseUnavailableError>>;
	getSystemPrompt(
		args: SystemPromptArgs,
	): Promise<Result<string, KnowledgeBaseUnavailableError>>;
}
