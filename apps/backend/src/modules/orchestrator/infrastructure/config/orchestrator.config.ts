import z from "zod";
import type { LlmProviderPort } from "@/modules/orchestrator/domain/ports/llm-provider.port";
import { FallbackLlmProviderAdapter } from "../llm/fallback-llm-provider.adapter";
import type { LlmProviderType } from "../llm/llm-provider.types";
import { VercelLlmProviderAdapter } from "../llm/vercel-llm-provider.adapter";

const VALID_PROVIDERS: readonly LlmProviderType[] = ["openai", "anthropic", "gemini"];

export const orchestratorConfigSchema = z
  .object({
    botToken: z.string().nonempty(),
    webhookSecret: z.string().nonempty(),
    redisUrl: z.string().nonempty(),
    mcpUrl: z.string().nonempty(),
    mcpToken: z.string().nonempty(),
    mcpTimeoutMs: z.coerce.number().default(10_000),
    // Defaults to true; only the literal "false"/"0" disables the gate (e.g. so
    // staging testers are not blocked outside business hours).
    businessHoursGateEnabled: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? true : v.toLowerCase() !== "false" && v !== "0")),
    llmModel: z.string().nonempty(),
    llmTemperature: z.coerce.number().optional().default(0.3),
    llmTimeoutMs: z.coerce.number().optional().default(30_000),
    llmFallbackChain: z.string().optional(), // e.g. "anthropic:claude-3-5-haiku,openai:gpt-4o-mini"
    llmProvider: z.enum(VALID_PROVIDERS),
    llmApiKeys: z.object({
      openai: z.string().optional(),
      anthropic: z.string().optional(),
      gemini: z.string().optional(),
    }),
  })
  .superRefine((config, ctx) => {
    if (!config.llmApiKeys[config.llmProvider]) {
      ctx.addIssue({
        code: "custom",
        message: `Missing API key for primary LLM provider "${config.llmProvider}". Set the corresponding env var.`,
      });
    }
  });

export type OrchestratorConfig = z.infer<typeof orchestratorConfigSchema>;

interface LlmConfig {
  provider: LlmProviderType;
  model: string;
  apiKey: string;
}

export function readOrchestratorConfig(env = process.env): OrchestratorConfig {
  return orchestratorConfigSchema.parse({
    botToken: env.TELEGRAM_BOT_TOKEN,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    redisUrl: env.REDIS_URL,
    mcpUrl: env.MCP_SERVER_URL,
    mcpToken: env.MCP_INTERNAL_TOKEN,
    mcpTimeoutMs: env.MCP_TIMEOUT_MS,
    businessHoursGateEnabled: env.BUSINESS_HOURS_GATE_ENABLED,
    llmModel: env.LLM_MODEL,
    llmProvider: env.LLM_PROVIDER,
    llmTemperature: env.LLM_TEMPERATURE,
    llmTimeoutMs: env.LLM_TIMEOUT_MS,
    llmFallbackChain: env.LLM_FALLBACK_CHAIN,
    llmApiKeys: {
      openai: env.OPENAI_API_KEY,
      anthropic: env.ANTHROPIC_API_KEY,
      gemini: env.GOOGLE_API_KEY,
    },
  });
}

function readPrimaryLlmConfig(config: OrchestratorConfig): LlmConfig {
  const { llmProvider, llmModel } = config;

  const apiKey = config.llmApiKeys[llmProvider];

  return { provider: llmProvider, model: llmModel, apiKey: apiKey! };
}

function readFallbackChain(primary: LlmConfig, config: OrchestratorConfig): LlmConfig[] {
  const raw = config.llmFallbackChain?.trim();
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

    if (provider === primary.provider && model === primary.model) {
      // Pointless to fall back to the same provider+model.
      continue;
    }
    const apiKey = config.llmApiKeys[provider as LlmProviderType];
    if (!apiKey) {
      throw new Error(`LLM_FALLBACK_CHAIN entry "${entry}" needs the API key for ${provider}.`);
    }
    chain.push({ provider: provider as LlmProviderType, model, apiKey });
  }
  return chain;
}

export function buildLlm(config: OrchestratorConfig): LlmProviderPort {
  const primary = readPrimaryLlmConfig(config);
  const primaryAdapter = new VercelLlmProviderAdapter({
    provider: primary.provider,
    model: primary.model,
    apiKey: primary.apiKey,
    defaultTemperature: config.llmTemperature,
    defaultTimeoutMs: config.llmTimeoutMs,
  });

  const fallbackConfigs = readFallbackChain(primary, config);
  if (fallbackConfigs.length === 0) return primaryAdapter;

  const chain: LlmProviderPort[] = [
    primaryAdapter,
    ...fallbackConfigs.map(
      (cfg) =>
        new VercelLlmProviderAdapter({
          provider: cfg.provider,
          model: cfg.model,
          apiKey: cfg.apiKey,
          defaultTemperature: config.llmTemperature,
          defaultTimeoutMs: config.llmTimeoutMs,
        }),
    ),
  ];

  return new FallbackLlmProviderAdapter(chain);
}
