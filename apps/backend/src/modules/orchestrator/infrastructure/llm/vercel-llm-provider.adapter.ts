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
	LlmMessage,
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
	// ai@6 retries internally before throwing AI_RetryError, which hides the
	// real statusCode/responseHeaders one level deeper. Inspect the unwrapped
	// inner error so a wrapped 429 still maps to LlmRateLimitError (the agentic
	// loop relies on that distinction to honor retry-after).
	const effective = unwrapAiRetryError(cause);
	if (isRateLimitError(effective)) {
		return new LlmRateLimitError(extractRetryAfterMs(effective), cause);
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

const MAX_AI_RETRY_UNWRAP_DEPTH = 3;

/**
 * Recursively unwraps `AI_RetryError` envelopes from the ai SDK. The SDK
 * wraps the last failed `APICallError` inside `.lastError` / `.errors[last]`,
 * which hides `statusCode` from a top-level shape check. We bound the depth
 * defensively so a hypothetical cyclic structure cannot stall us.
 */
function unwrapAiRetryError(cause: unknown, depth = 0): unknown {
	if (depth >= MAX_AI_RETRY_UNWRAP_DEPTH) return cause;
	if (cause === null || typeof cause !== "object") return cause;
	const obj = cause as {
		name?: unknown;
		lastError?: unknown;
		errors?: unknown;
	};
	if (obj.name !== "AI_RetryError") return cause;
	const inner =
		obj.lastError ??
		(Array.isArray(obj.errors) && obj.errors.length > 0
			? obj.errors[obj.errors.length - 1]
			: undefined);
	if (inner === undefined) return cause;
	return unwrapAiRetryError(inner, depth + 1);
}

function isRateLimitError(cause: unknown): boolean {
	if (cause === null || typeof cause !== "object") return false;
	const obj = cause as { statusCode?: unknown; status?: unknown };
	return obj.statusCode === 429 || obj.status === 429;
}

function extractRetryAfterMs(cause: unknown): number | undefined {
	if (cause === null || typeof cause !== "object") return undefined;
	const obj = cause as {
		retryAfterMs?: unknown;
		responseHeaders?: unknown;
	};
	if (typeof obj.retryAfterMs === "number") return obj.retryAfterMs;
	// APICallError exposes the raw HTTP `retry-after` header (seconds per
	// RFC 7231) on `responseHeaders`. Parse it best-effort.
	if (obj.responseHeaders !== null && typeof obj.responseHeaders === "object") {
		const headers = obj.responseHeaders as Record<string, unknown>;
		const raw = headers["retry-after"] ?? headers["Retry-After"];
		if (typeof raw === "string") {
			const seconds = Number.parseFloat(raw);
			if (Number.isFinite(seconds) && seconds >= 0) {
				return Math.round(seconds * 1000);
			}
		}
	}
	return undefined;
}

/**
 * Splits the domain `LlmMessage[]` into a top-level `system` string and the
 * non-system messages the SDK accepts in `messages`. Done in the adapter (not
 * the bridge) so the bridge stays a thin SDK proxy and other LlmProviderPort
 * implementations can apply the same convention.
 */
function splitSystemMessages(messages: LlmMessage[]): {
	system: string | undefined;
	rest: Array<{ role: "user" | "assistant"; content: string }>;
} {
	const systemContents: string[] = [];
	const rest: Array<{ role: "user" | "assistant"; content: string }> = [];
	for (const m of messages) {
		if (m.role === "system") {
			systemContents.push(m.content);
		} else {
			rest.push({ role: m.role, content: m.content });
		}
	}
	return {
		system: systemContents.length > 0 ? systemContents.join("\n\n") : undefined,
		rest,
	};
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
		const { system, rest } = splitSystemMessages(req.messages);

		try {
			const result = await this.bridge.generateText({
				provider: this.provider,
				model: this.model,
				apiKey: this.apiKey,
				...(system !== undefined ? { system } : {}),
				messages: rest,
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
		const { system, rest } = splitSystemMessages(req.messages);

		let result: VercelGenerateObjectResult<T>;
		try {
			result = await this.bridge.generateObject<T>({
				provider: this.provider,
				model: this.model,
				apiKey: this.apiKey,
				...(system !== undefined ? { system } : {}),
				messages: rest,
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
