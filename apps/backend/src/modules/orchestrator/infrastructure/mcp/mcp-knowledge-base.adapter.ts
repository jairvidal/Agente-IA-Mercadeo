import { KnowledgeBaseUnavailableError } from "@/modules/orchestrator/domain/errors";
import type {
  KnowledgeBasePort,
  SystemPromptArgs,
} from "@/modules/orchestrator/domain/ports/knowledge-base.port";

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

  async getFaqCatalog(): Promise<string> {
    const now = this.now();
    if (this.cache && now < this.cache.expiresAt) {
      return this.cache.value;
    }

    let value: string;
    try {
      value = await this.mcp.readResource(FAQ_CATALOG_URI);
    } catch (err) {
      throw new KnowledgeBaseUnavailableError("getFaqCatalog", err);
    }

    this.cache = { value, expiresAt: now + CATALOG_CACHE_TTL_MS };
    return value;
  }

  async getSystemPrompt(args: SystemPromptArgs): Promise<string> {
    const promptArgs: Record<string, string> = { context: args.context };
    if (args.habeasDataConsent === true) {
      promptArgs.habeas_data_consent = "true";
    } else if (args.habeasDataConsent === false) {
      promptArgs.habeas_data_consent = "false";
    }

    try {
      return await this.mcp.getPrompt(SYSTEM_PROMPT_NAME, promptArgs);
    } catch (err) {
      throw new KnowledgeBaseUnavailableError("getSystemPrompt", err);
    }
  }
}
