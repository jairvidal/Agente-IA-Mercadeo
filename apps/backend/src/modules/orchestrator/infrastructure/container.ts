import { ProcessTelegramMessageUseCase } from "@/modules/orchestrator/application/use-cases/process-telegram-message.use-case";
import type { AgentToolPort } from "@/modules/orchestrator/domain/ports/agent-tool.port";
import type { KnowledgeBasePort } from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";

import { TelegramChannelAdapter } from "./channels/telegram.adapter";
import { buildTelegramRoutes } from "./http/telegram-webhook.routes";
import { McpAgentToolAdapter } from "./mcp/mcp-agent-tool.adapter";
import { McpKnowledgeBaseAdapter } from "./mcp/mcp-knowledge-base.adapter";
import { SdkMcpClient } from "./mcp/sdk-mcp-client.adapter";
import { getIoredis, IoredisAdapter } from "./persistence/ioredis.adapter";
import { RedisSessionRepository } from "./persistence/redis-session.repository";

export interface OrchestratorModule {
	routes: ReturnType<typeof buildTelegramRoutes>;
	knowledgeBase: KnowledgeBasePort;
	agentTools: AgentToolPort;
}

export function buildOrchestratorModule(): OrchestratorModule {
	const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
	const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
	const redisUrl = process.env.REDIS_URL ?? "";
	const mcpUrl = process.env.MCP_SERVER_URL ?? "";
	const mcpToken = process.env.MCP_INTERNAL_TOKEN ?? "";
	const mcpTimeoutMs = Number(process.env.MCP_TIMEOUT_MS ?? 10_000);

	if (!botToken || !webhookSecret) {
		throw new Error(
			"Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET env vars",
		);
	}
	if (!redisUrl) {
		throw new Error("Missing REDIS_URL env var");
	}
	if (!mcpUrl || !mcpToken) {
		throw new Error("Missing MCP_SERVER_URL or MCP_INTERNAL_TOKEN env vars");
	}

	const sessions: SessionRepositoryPort = new RedisSessionRepository(
		new IoredisAdapter(getIoredis(redisUrl)),
	);

	const mcp = new SdkMcpClient({
		url: mcpUrl,
		token: mcpToken,
		timeoutMs: mcpTimeoutMs,
	});
	const knowledgeBase: KnowledgeBasePort = new McpKnowledgeBaseAdapter(mcp);
	const agentTools: AgentToolPort = new McpAgentToolAdapter(mcp);

	const channel = new TelegramChannelAdapter(botToken);
	const useCase = new ProcessTelegramMessageUseCase(channel, sessions);

	return {
		routes: buildTelegramRoutes({
			adapter: channel,
			useCase,
			webhookSecret,
		}),
		knowledgeBase,
		agentTools,
	};
}
