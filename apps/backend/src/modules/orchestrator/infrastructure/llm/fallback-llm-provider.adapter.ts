import {
	type LlmError,
	LlmInvalidResponseError,
} from "@/modules/orchestrator/domain/errors";
import type {
	LlmCompletionRequest,
	LlmCompletionResponse,
	LlmProviderPort,
	LlmStructuredRequest,
	LlmStructuredResponse,
} from "@/modules/orchestrator/domain/ports/llm-provider.port";
import { err, type Result } from "@/modules/orchestrator/domain/result";

/**
 * Iterates a chain of `LlmProviderPort` instances and returns the first `Ok`.
 *
 * Failover policy:
 *   - Transient errors (`LlmProviderUnavailableError`, `LlmTimeoutError`,
 *     `LlmRateLimitError`) advance to the next provider.
 *   - `LlmInvalidResponseError` short-circuits and returns immediately — a
 *     schema mismatch is almost always a bug in the prompt/schema and the
 *     same call against another provider would be misleading.
 *   - If every provider fails, the LAST `Err` is propagated (operators care
 *     about the final failure mode, not the first).
 */
export class FallbackLlmProviderAdapter implements LlmProviderPort {
	private readonly chain: readonly LlmProviderPort[];

	constructor(chain: LlmProviderPort[]) {
		if (chain.length === 0) {
			throw new Error(
				"FallbackLlmProviderAdapter requires at least one provider in the chain",
			);
		}
		this.chain = chain;
	}

	async complete(
		req: LlmCompletionRequest,
	): Promise<Result<LlmCompletionResponse, LlmError>> {
		let lastErr: Result<LlmCompletionResponse, LlmError> | null = null;
		for (const provider of this.chain) {
			const r = await provider.complete(req);
			if (r.ok) return r;
			if (r.error instanceof LlmInvalidResponseError) return r;
			lastErr = r;
		}
		// `chain.length >= 1` is enforced in the constructor, so lastErr is set.
		return lastErr ?? err(new Error("unreachable") as unknown as LlmError);
	}

	async completeStructured<T>(
		req: LlmStructuredRequest<unknown>,
	): Promise<Result<LlmStructuredResponse<T>, LlmError>> {
		let lastErr: Result<LlmStructuredResponse<T>, LlmError> | null = null;
		for (const provider of this.chain) {
			const r = await provider.completeStructured<T>(req);
			if (r.ok) return r;
			if (r.error instanceof LlmInvalidResponseError) return r;
			lastErr = r;
		}
		return lastErr ?? err(new Error("unreachable") as unknown as LlmError);
	}
}
