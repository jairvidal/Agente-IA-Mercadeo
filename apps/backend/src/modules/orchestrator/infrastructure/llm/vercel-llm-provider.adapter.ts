import {
	type LlmError,
	LlmInvalidResponseError,
	LlmProviderUnavailableError,
	LlmRateLimitError,
	LlmTimeoutError,
} from "@/modules/orchestrator/domain/errors";
import type {
	LlmCompletionRequest,
	LlmCompletionResponse,
	LlmProviderPort,
	LlmStructuredRequest,
	LlmStructuredResponse,
	LlmToolCall,
	LlmUsage,
} from "@/modules/orchestrator/domain/ports/llm-provider.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import { defaultVercelAiBridge } from "./default-vercel-ai.bridge";
import type {
	LlmProviderType,
	VercelAiBridge,
	VercelGenerateObjectResult,
	VercelGenerateTextResult,
} from "./llm-provider.types";

const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_TIMEOUT_MS = 30_000;

export interface VercelLlmProviderAdapterConfig {
	provider: LlmProviderType;
	model: string;
	apiKey: string;
	defaultTemperature?: number;
	defaultTimeoutMs?: number;
}

export interface VercelLlmProviderAdapterDeps {
	bridge?: VercelAiBridge;
}

/**
 * Maps a thrown Vercel AI SDK error (or any cause) into the domain error
 * union. The mapping is intentionally narrow — we only special-case timeouts
 * and rate limits because those have distinct retry semantics in the agentic
 * loop. Everything else collapses into `LlmProviderUnavailableError`.
 */
function mapBridgeError(operation: string, cause: unknown): LlmError {
	if (isAbortError(cause)) {
		return new LlmTimeoutError(extractTimeoutMs(cause) ?? 0, cause);
	}
	if (isRateLimitError(cause)) {
		return new LlmRateLimitError(extractRetryAfterMs(cause), cause);
	}
	return new LlmProviderUnavailableError(operation, cause);
}

function isAbortError(cause: unknown): boolean {
	if (cause instanceof Error) {
		// `AbortSignal.timeout()` rejects with a DOMException whose `.name` is
		// "TimeoutError"; manual aborts produce `name === "AbortError"`.
		return cause.name === "AbortError" || cause.name === "TimeoutError";
	}
	return false;
}

function extractTimeoutMs(cause: unknown): number | undefined {
	if (
		cause instanceof Error &&
		"timeoutMs" in cause &&
		typeof (cause as { timeoutMs: unknown }).timeoutMs === "number"
	) {
		return (cause as { timeoutMs: number }).timeoutMs;
	}
	return undefined;
}

function isRateLimitError(cause: unknown): boolean {
	if (cause === null || typeof cause !== "object") return false;
	const obj = cause as { statusCode?: unknown; status?: unknown };
	return obj.statusCode === 429 || obj.status === 429;
}

function extractRetryAfterMs(cause: unknown): number | undefined {
	if (cause === null || typeof cause !== "object") return undefined;
	const obj = cause as { retryAfterMs?: unknown };
	if (typeof obj.retryAfterMs === "number") return obj.retryAfterMs;
	return undefined;
}

function isZodLikeError(cause: unknown): boolean {
	if (cause === null || typeof cause !== "object") return false;
	const name = (cause as { name?: unknown }).name;
	return name === "ZodError" || name === "AI_NoObjectGeneratedError";
}

function mapUsage(usage: VercelGenerateTextResult["usage"]): LlmUsage {
	return {
		inputTokens: usage.inputTokens ?? 0,
		outputTokens: usage.outputTokens ?? 0,
	};
}

function mapToolCalls(
	toolCalls: VercelGenerateTextResult["toolCalls"],
): LlmToolCall[] | undefined {
	if (!toolCalls) return undefined;
	return toolCalls.map((tc) => ({
		name: tc.toolName,
		arguments:
			tc.input !== null && typeof tc.input === "object"
				? (tc.input as Record<string, unknown>)
				: {},
	}));
}

/**
 * Adapter that translates `LlmProviderPort` into Vercel AI SDK calls.
 *
 * Boundary contract:
 *   - No throw escapes. Every failure path returns `err(...)`.
 *   - Timeouts use `AbortSignal.timeout(timeoutMs)` per call — no shared signal.
 *   - The `bridge` is injectable: tests pass a fake; prod uses `defaultVercelAiBridge`.
 */
export class VercelLlmProviderAdapter implements LlmProviderPort {
	private readonly provider: LlmProviderType;
	private readonly model: string;
	private readonly apiKey: string;
	private readonly defaultTemperature: number;
	private readonly defaultTimeoutMs: number;
	private readonly bridge: VercelAiBridge;

	constructor(
		config: VercelLlmProviderAdapterConfig,
		deps: VercelLlmProviderAdapterDeps = {},
	) {
		this.provider = config.provider;
		this.model = config.model;
		this.apiKey = config.apiKey;
		this.defaultTemperature = config.defaultTemperature ?? DEFAULT_TEMPERATURE;
		this.defaultTimeoutMs = config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
		this.bridge = deps.bridge ?? defaultVercelAiBridge;
	}

	async complete(
		req: LlmCompletionRequest,
	): Promise<Result<LlmCompletionResponse, LlmError>> {
		const temperature = req.temperature ?? this.defaultTemperature;
		const timeoutMs = req.timeoutMs ?? this.defaultTimeoutMs;

		try {
			const result = await this.bridge.generateText({
				provider: this.provider,
				model: this.model,
				apiKey: this.apiKey,
				messages: req.messages,
				...(req.tools !== undefined ? { tools: req.tools } : {}),
				temperature,
				abortSignal: AbortSignal.timeout(timeoutMs),
			});

			const toolCalls = mapToolCalls(result.toolCalls);
			return ok({
				content: result.text,
				...(toolCalls !== undefined ? { toolCalls } : {}),
				usage: mapUsage(result.usage),
			});
		} catch (cause) {
			const mapped = mapBridgeError("complete", cause);
			if (mapped instanceof LlmTimeoutError && mapped.timeoutMs === 0) {
				// Preserve the actual configured timeout in the error.
				return err(new LlmTimeoutError(timeoutMs, cause));
			}
			return err(mapped);
		}
	}

	async completeStructured<T>(
		req: LlmStructuredRequest<unknown>,
	): Promise<Result<LlmStructuredResponse<T>, LlmError>> {
		const temperature = req.temperature ?? this.defaultTemperature;
		const timeoutMs = req.timeoutMs ?? this.defaultTimeoutMs;

		let result: VercelGenerateObjectResult<T>;
		try {
			result = await this.bridge.generateObject<T>({
				provider: this.provider,
				model: this.model,
				apiKey: this.apiKey,
				messages: req.messages,
				schema: req.schema,
				temperature,
				abortSignal: AbortSignal.timeout(timeoutMs),
			});
		} catch (cause) {
			if (isZodLikeError(cause)) {
				return err(
					new LlmInvalidResponseError(
						"schema validation failed in generateObject",
						cause,
					),
				);
			}
			const mapped = mapBridgeError("completeStructured", cause);
			if (mapped instanceof LlmTimeoutError && mapped.timeoutMs === 0) {
				return err(new LlmTimeoutError(timeoutMs, cause));
			}
			return err(mapped);
		}

		return ok({
			object: result.object,
			usage: mapUsage(result.usage),
		});
	}
}
