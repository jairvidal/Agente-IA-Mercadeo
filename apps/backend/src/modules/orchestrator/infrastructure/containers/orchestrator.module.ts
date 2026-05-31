import { MapAgentRegistry } from "@/modules/orchestrator/application/agents/agent-registry";
import { FaqAgent } from "@/modules/orchestrator/application/agents/faq-agent";
import { QuotationAgent } from "@/modules/orchestrator/application/agents/quotation-agent";
import { IntentClassifierService } from "@/modules/orchestrator/application/services/intent-classifier.service";
import { HandleHabeasDataConsentUseCase } from "@/modules/orchestrator/application/use-cases/handle-habeas-data-consent.use-case";
import { ProcessTelegramMessageUseCase } from "@/modules/orchestrator/application/use-cases/process-telegram-message.use-case";
import {
  FAQ_AGENT_TOOLS,
  QUOTATION_AGENT_TOOLS,
} from "@/modules/orchestrator/domain/constants";
import type { AgentToolPort } from "@/modules/orchestrator/domain/ports/agent-tool.port";
import type { KnowledgeBasePort } from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import type { LlmProviderPort } from "@/modules/orchestrator/domain/ports/llm-provider.port";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";
import { logger } from "@sidoc/observability";
import { TelegramChannelAdapter } from "../channels/telegram.adapter";
import { buildLlm, OrchestratorConfig } from "../config/orchestrator.config";
import { buildTelegramRoutes } from "../http/telegram-webhook.routes";
import { McpAgentToolAdapter } from "../mcp/mcp-agent-tool.adapter";
import { McpKnowledgeBaseAdapter } from "../mcp/mcp-knowledge-base.adapter";
import { SdkMcpClient } from "../mcp/sdk-mcp-client.adapter";
import {
  getIoredis,
  IoredisAdapter,
  pingRedis,
  redactRedisUrl,
} from "../persistence/ioredis.adapter";
import { RedisSessionRepository } from "../persistence/redis-session.repository";

export interface OrchestratorModule {
  routes: ReturnType<typeof buildTelegramRoutes>;
  knowledgeBase: KnowledgeBasePort;
  agentTools: AgentToolPort;
  llm: LlmProviderPort;
}

export async function buildOrchestratorModule(
  config: OrchestratorConfig,
): Promise<OrchestratorModule> {
  const redis = getIoredis(config.redisUrl);
  try {
    await pingRedis(redis);
  } catch (cause) {
    const code =
      cause !== null && typeof cause === "object" && "code" in cause
        ? String((cause as { code: unknown }).code)
        : undefined;
    const message = cause instanceof Error ? cause.message : String(cause);
    const safeUrl = redactRedisUrl(config.redisUrl);
    logger.error(
      { err: cause, code, safeUrl },
      `Failed to connect to Redis at ${safeUrl}${code ? ` (${code})` : ""}`,
    );
    throw new Error(
      `Redis unavailable at ${safeUrl}${code ? ` (${code})` : ""}: ${message}`,
      {
        cause,
      },
    );
  }

  const sessions: SessionRepositoryPort = new RedisSessionRepository(
    new IoredisAdapter(redis),
  );

  const mcp = new SdkMcpClient({
    url: config.mcpUrl,
    token: config.mcpToken,
    timeoutMs: config.mcpTimeoutMs,
  });
  const knowledgeBase: KnowledgeBasePort = new McpKnowledgeBaseAdapter(mcp);
  const agentTools: AgentToolPort = new McpAgentToolAdapter(mcp);

  const llm: LlmProviderPort = buildLlm(config);

  const channel = new TelegramChannelAdapter(config.botToken);
  const classifier = new IntentClassifierService({ llm });

  const faqAgent = new FaqAgent({
    llm,
    agentTools,
    knowledgeBase,
    allowedTools: new Set<string>(FAQ_AGENT_TOOLS),
  });
  const quotationAgent = new QuotationAgent({
    llm,
    agentTools,
    knowledgeBase,
    allowedTools: new Set<string>(QUOTATION_AGENT_TOOLS),
  });
  const registry = new MapAgentRegistry({
    faq: faqAgent,
    quotation: quotationAgent,
  });

  const consent = new HandleHabeasDataConsentUseCase({ sessions });

  const useCase = new ProcessTelegramMessageUseCase({
    channel,
    sessions,
    classifier,
    registry,
    consent,
  });

  return {
    routes: buildTelegramRoutes({
      adapter: channel,
      useCase,
      webhookSecret: config.webhookSecret,
    }),
    knowledgeBase,
    agentTools,
    llm,
  };
}
