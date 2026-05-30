import { MapAgentRegistry } from "@/modules/orchestrator/application/agents/agent-registry";
import { FaqAgent } from "@/modules/orchestrator/application/agents/faq-agent";
import { QuotationAgent } from "@/modules/orchestrator/application/agents/quotation-agent";
import { IntentClassifierService } from "@/modules/orchestrator/application/services/intent-classifier.service";
import { HandleHabeasDataConsentUseCase } from "@/modules/orchestrator/application/use-cases/handle-habeas-data-consent.use-case";
import { ProcessTelegramMessageUseCase } from "@/modules/orchestrator/application/use-cases/process-telegram-message.use-case";
import { FAQ_AGENT_TOOLS, QUOTATION_AGENT_TOOLS } from "@/modules/orchestrator/domain/constants";
import type { AgentToolPort } from "@/modules/orchestrator/domain/ports/agent-tool.port";
import type { KnowledgeBasePort } from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import type { LlmProviderPort } from "@/modules/orchestrator/domain/ports/llm-provider.port";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";

import { TelegramChannelAdapter } from "./channels/telegram.adapter";
import { buildTelegramRoutes } from "./http/telegram-webhook.routes";
import { FallbackLlmProviderAdapter } from "./llm/fallback-llm-provider.adapter";
import type { LlmProviderType } from "./llm/llm-provider.types";
import { VercelLlmProviderAdapter } from "./llm/vercel-llm-provider.adapter";
import { McpAgentToolAdapter } from "./mcp/mcp-agent-tool.adapter";
import { McpKnowledgeBaseAdapter } from "./mcp/mcp-knowledge-base.adapter";
import { SdkMcpClient } from "./mcp/sdk-mcp-client.adapter";
import {
	getIoredis,
	IoredisAdapter,
	pingRedis,
	redactRedisUrl,
} from "./persistence/ioredis.adapter";
import { RedisSessionRepository } from "./persistence/redis-session.repository";

export interface OrchestratorModule {
	routes: ReturnType<typeof buildTelegramRoutes>;
	knowledgeBase: KnowledgeBasePort;
	agentTools: AgentToolPort;
	llm: LlmProviderPort;
}

const VALID_PROVIDERS: readonly LlmProviderType[] = ["openai", "anthropic", "gemini"];

function isLlmProvider(value: string): value is LlmProviderType {
	return (VALID_PROVIDERS as readonly string[]).includes(value);
}

interface LlmConfig {
	provider: LlmProviderType;
	model: string;
	apiKey: string;
}

function apiKeyForProvider(provider: LlmProviderType): string | undefined {
	switch (provider) {
		case "openai":
			return process.env.OPENAI_API_KEY;
		case "anthropic":
			return process.env.ANTHROPIC_API_KEY;
		case "gemini":
			return process.env.GOOGLE_API_KEY;
	}
}

function readPrimaryLlmConfig(): LlmConfig {
	const provider = process.env.LLM_PROVIDER ?? "";
	const model = process.env.LLM_MODEL ?? "";

	if (!provider || !model) {
		throw new Error("Missing LLM_PROVIDER or LLM_MODEL env vars");
	}
	if (!isLlmProvider(provider)) {
		throw new Error(
			`Invalid LLM_PROVIDER: ${provider}. Expected one of: ${VALID_PROVIDERS.join(", ")}`,
		);
	}
	const apiKey = apiKeyForProvider(provider);
	if (!apiKey) {
		throw new Error(
			`Missing API key env var for LLM_PROVIDER=${provider}. ` +
				`Set ${provider === "gemini" ? "GOOGLE_API_KEY" : `${provider.toUpperCase()}_API_KEY`}.`,
		);
	}
	return { provider, model, apiKey };
}

/**
 * Parses `LLM_FALLBACK_CHAIN` (e.g. "anthropic:claude-3-5-haiku,openai:gpt-4o-mini").
 *
 * Entries are rejected if:
 *   - the provider is unknown,
 *   - the corresponding API key env var is missing,
 *   - the entry duplicates the primary provider.
 *
 * Rationale: fail fast at boot rather than discover at runtime that the
 * fallback chain is broken.
 */
function readFallbackChain(primary: LlmConfig): LlmConfig[] {
	const raw = process.env.LLM_FALLBACK_CHAIN;
	if (!raw) return [];

	const chain: LlmConfig[] = [];
	for (const entry of raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)) {
		const [provider, model] = entry.split(":");
		if (!provider || !model) {
			throw new Error(`Invalid LLM_FALLBACK_CHAIN entry "${entry}". Expected "provider:model".`);
		}
		if (!isLlmProvider(provider)) {
			throw new Error(
				`Invalid provider "${provider}" in LLM_FALLBACK_CHAIN. ` +
					`Expected one of: ${VALID_PROVIDERS.join(", ")}.`,
			);
		}
		if (provider === primary.provider && model === primary.model) {
			// Pointless to fall back to the same provider+model.
			continue;
		}
		const apiKey = apiKeyForProvider(provider);
		if (!apiKey) {
			throw new Error(`LLM_FALLBACK_CHAIN entry "${entry}" needs the API key for ${provider}.`);
		}
		chain.push({ provider, model, apiKey });
	}
	return chain;
}

function buildLlm(): LlmProviderPort {
	const temperature = Number(process.env.LLM_TEMPERATURE ?? 0.3);
	const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 30_000);

	const primary = readPrimaryLlmConfig();
	const primaryAdapter = new VercelLlmProviderAdapter({
		provider: primary.provider,
		model: primary.model,
		apiKey: primary.apiKey,
		defaultTemperature: temperature,
		defaultTimeoutMs: timeoutMs,
	});

	const fallbackConfigs = readFallbackChain(primary);
	if (fallbackConfigs.length === 0) return primaryAdapter;

	const chain: LlmProviderPort[] = [
		primaryAdapter,
		...fallbackConfigs.map(
			(cfg) =>
				new VercelLlmProviderAdapter({
					provider: cfg.provider,
					model: cfg.model,
					apiKey: cfg.apiKey,
					defaultTemperature: temperature,
					defaultTimeoutMs: timeoutMs,
				}),
		),
	];

	return new FallbackLlmProviderAdapter(chain);
}

export async function buildOrchestratorModule(): Promise<OrchestratorModule> {
	const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
	const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
	const redisUrl = process.env.REDIS_URL ?? "";
	const mcpUrl = process.env.MCP_SERVER_URL ?? "";
	const mcpToken = process.env.MCP_INTERNAL_TOKEN ?? "";
	const mcpTimeoutMs = Number(process.env.MCP_TIMEOUT_MS ?? 10_000);

	if (!botToken || !webhookSecret) {
		throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET env vars");
	}
	if (!redisUrl) {
		throw new Error("Missing REDIS_URL env var");
	}
	if (!mcpUrl || !mcpToken) {
		throw new Error("Missing MCP_SERVER_URL or MCP_INTERNAL_TOKEN env vars");
	}

	const redis = getIoredis(redisUrl);
	try {
		await pingRedis(redis);
	} catch (cause) {
		const code =
			cause !== null && typeof cause === "object" && "code" in cause
				? String((cause as { code: unknown }).code)
				: undefined;
		const message = cause instanceof Error ? cause.message : String(cause);
		const safeUrl = redactRedisUrl(redisUrl);
		console.error(
			[
				`[boot] Redis is not reachable at ${safeUrl}${code ? ` (${code})` : ""}: ${message}`,
				"Hint: is Redis running? Try one of:",
				"  docker start redis-sidoc",
				"  docker run -d --name redis-sidoc -p 6379:6379 redis:7-alpine",
			].join("\n"),
		);
		throw new Error(`Redis unavailable at ${safeUrl}${code ? ` (${code})` : ""}: ${message}`, {
			cause,
		});
	}

	const sessions: SessionRepositoryPort = new RedisSessionRepository(new IoredisAdapter(redis));

	const mcp = new SdkMcpClient({
		url: mcpUrl,
		token: mcpToken,
		timeoutMs: mcpTimeoutMs,
	});
	const knowledgeBase: KnowledgeBasePort = new McpKnowledgeBaseAdapter(mcp);
	const agentTools: AgentToolPort = new McpAgentToolAdapter(mcp);

	const llm: LlmProviderPort = buildLlm();

	const channel = new TelegramChannelAdapter(botToken);
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
			webhookSecret,
		}),
		knowledgeBase,
		agentTools,
		llm,
	};
}
