/**
 * Internal infrastructure types for the LLM adapter. NOT part of the domain.
 */

export type LlmProviderType = "openai" | "anthropic" | "gemini";

/**
 * Minimal shape of a Vercel AI SDK `generateText` result that the adapter cares
 * about. Kept narrow on purpose: only what the adapter needs to map onto
 * `LlmCompletionResponse`. Tests can satisfy this without depending on the SDK.
 */
export interface VercelGenerateTextResult {
	text: string;
	toolCalls?: Array<{ toolName: string; input: unknown }>;
	usage: {
		inputTokens?: number;
		outputTokens?: number;
	};
}

/** Same idea as above for `generateObject`. */
export interface VercelGenerateObjectResult<T> {
	object: T;
	usage: {
		inputTokens?: number;
		outputTokens?: number;
	};
}

/**
 * Bridge to the Vercel AI SDK. The adapter receives one of these in its
 * constructor (Option A — inyected bridge) so tests can supply a fake without
 * mocking the global `ai` module. The default bridge wraps `generateText` and
 * `generateObject` 1:1.
 */
export interface VercelAiBridge {
	generateText(
		params: VercelGenerateTextParams,
	): Promise<VercelGenerateTextResult>;
	generateObject<T>(
		params: VercelGenerateObjectParams,
	): Promise<VercelGenerateObjectResult<T>>;
}

export interface VercelGenerateTextParams {
	provider: LlmProviderType;
	model: string;
	apiKey: string;
	messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
	tools?: Array<{
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	}>;
	temperature: number;
	abortSignal: AbortSignal;
}

export interface VercelGenerateObjectParams {
	provider: LlmProviderType;
	model: string;
	apiKey: string;
	messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
	schema: unknown;
	temperature: number;
	abortSignal: AbortSignal;
}
