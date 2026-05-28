export class InvalidMessageError extends Error {
	constructor(reason: string) {
		super(`Invalid message: ${reason}`);
		this.name = "InvalidMessageError";
	}
}

export class KnowledgeBaseUnavailableError extends Error {
	constructor(operation: string, cause?: unknown) {
		super(`Knowledge base unavailable: ${operation}`);
		this.name = "KnowledgeBaseUnavailableError";
		if (cause !== undefined) this.cause = cause;
	}
}

export class ToolInvocationError extends Error {
	constructor(tool: string, cause?: unknown) {
		super(`Tool invocation failed: ${tool}`);
		this.name = "ToolInvocationError";
		if (cause !== undefined) this.cause = cause;
	}
}

export class SessionRepositoryError extends Error {
	constructor(operation: string, cause?: unknown) {
		super(`Session repository failed: ${operation}`);
		this.name = "SessionRepositoryError";
		if (cause !== undefined) this.cause = cause;
	}
}

export class MessageChannelError extends Error {
	constructor(operation: string, cause?: unknown) {
		super(`Message channel failed: ${operation}`);
		this.name = "MessageChannelError";
		if (cause !== undefined) this.cause = cause;
	}
}

export class LlmProviderUnavailableError extends Error {
	constructor(operation: string, cause?: unknown) {
		super(`LLM provider unavailable: ${operation}`);
		this.name = "LlmProviderUnavailableError";
		if (cause !== undefined) this.cause = cause;
	}
}

export class LlmTimeoutError extends Error {
	constructor(
		public readonly timeoutMs: number,
		cause?: unknown,
	) {
		super(`LLM call exceeded ${timeoutMs}ms`);
		this.name = "LlmTimeoutError";
		if (cause !== undefined) this.cause = cause;
	}
}

export class LlmRateLimitError extends Error {
	constructor(
		public readonly retryAfterMs?: number,
		cause?: unknown,
	) {
		super(
			retryAfterMs !== undefined
				? `LLM rate limited (retry after ${retryAfterMs}ms)`
				: "LLM rate limited",
		);
		this.name = "LlmRateLimitError";
		if (cause !== undefined) this.cause = cause;
	}
}

export class LlmInvalidResponseError extends Error {
	constructor(reason: string, cause?: unknown) {
		super(`LLM returned invalid response: ${reason}`);
		this.name = "LlmInvalidResponseError";
		if (cause !== undefined) this.cause = cause;
	}
}

export type LlmError =
	| LlmProviderUnavailableError
	| LlmTimeoutError
	| LlmRateLimitError
	| LlmInvalidResponseError;
