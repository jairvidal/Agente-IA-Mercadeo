import { describe, expect, it } from "bun:test";

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
} from "@/modules/orchestrator/domain/ports/llm-provider.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import { FallbackLlmProviderAdapter } from "../fallback-llm-provider.adapter";

class FakeLlmProvider implements LlmProviderPort {
	completeCalls = 0;
	completeStructuredCalls = 0;

	constructor(
		private readonly completeResult: Result<LlmCompletionResponse, LlmError>,
		private readonly completeStructuredResult: Result<
			LlmStructuredResponse<unknown>,
			LlmError
		> = ok({
			object: {},
			usage: { inputTokens: 0, outputTokens: 0 },
		}),
	) {}

	async complete(
		_req: LlmCompletionRequest,
	): Promise<Result<LlmCompletionResponse, LlmError>> {
		this.completeCalls++;
		return this.completeResult;
	}

	async completeStructured<T>(
		_req: LlmStructuredRequest<unknown>,
	): Promise<Result<LlmStructuredResponse<T>, LlmError>> {
		this.completeStructuredCalls++;
		return this.completeStructuredResult as Result<
			LlmStructuredResponse<T>,
			LlmError
		>;
	}
}

const okResponse: LlmCompletionResponse = {
	content: "primary-ok",
	usage: { inputTokens: 1, outputTokens: 1 },
};

const req: LlmCompletionRequest = { messages: [] };

describe("FallbackLlmProviderAdapter", () => {
	it("throws synchronously if the chain is empty", () => {
		expect(() => new FallbackLlmProviderAdapter([])).toThrow();
	});

	describe("complete()", () => {
		it("returns Ok from the first provider when it succeeds (no fallback consulted)", async () => {
			const primary = new FakeLlmProvider(ok(okResponse));
			const secondary = new FakeLlmProvider(
				err(new LlmProviderUnavailableError("complete")),
			);

			const fallback = new FallbackLlmProviderAdapter([primary, secondary]);
			const result = await fallback.complete(req);

			expect(result.ok).toBe(true);
			expect(primary.completeCalls).toBe(1);
			expect(secondary.completeCalls).toBe(0);
		});

		it("falls back on LlmProviderUnavailableError and returns Ok from the second", async () => {
			const primary = new FakeLlmProvider(
				err(new LlmProviderUnavailableError("complete")),
			);
			const secondary = new FakeLlmProvider(
				ok({ ...okResponse, content: "secondary-ok" }),
			);

			const fallback = new FallbackLlmProviderAdapter([primary, secondary]);
			const result = await fallback.complete(req);

			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value.content).toBe("secondary-ok");
			expect(primary.completeCalls).toBe(1);
			expect(secondary.completeCalls).toBe(1);
		});

		it("falls back on LlmTimeoutError and LlmRateLimitError", async () => {
			const timeoutPrimary = new FakeLlmProvider(
				err(new LlmTimeoutError(30_000)),
			);
			const rateLimitedSecondary = new FakeLlmProvider(
				err(new LlmRateLimitError(1000)),
			);
			const tertiary = new FakeLlmProvider(ok(okResponse));

			const fallback = new FallbackLlmProviderAdapter([
				timeoutPrimary,
				rateLimitedSecondary,
				tertiary,
			]);
			const result = await fallback.complete(req);

			expect(result.ok).toBe(true);
			expect(timeoutPrimary.completeCalls).toBe(1);
			expect(rateLimitedSecondary.completeCalls).toBe(1);
			expect(tertiary.completeCalls).toBe(1);
		});

		it("short-circuits on LlmInvalidResponseError — does NOT fall back", async () => {
			const primary = new FakeLlmProvider(
				err(new LlmInvalidResponseError("bug")),
			);
			const secondary = new FakeLlmProvider(ok(okResponse));

			const fallback = new FallbackLlmProviderAdapter([primary, secondary]);
			const result = await fallback.complete(req);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmInvalidResponseError);
			}
			expect(secondary.completeCalls).toBe(0);
		});

		it("propagates the LAST Err when every provider fails", async () => {
			const primary = new FakeLlmProvider(
				err(new LlmProviderUnavailableError("first")),
			);
			const secondary = new FakeLlmProvider(err(new LlmTimeoutError(30_000)));

			const fallback = new FallbackLlmProviderAdapter([primary, secondary]);
			const result = await fallback.complete(req);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmTimeoutError);
			}
		});
	});

	describe("completeStructured()", () => {
		it("does NOT fall back on LlmInvalidResponseError (schema mismatch is a bug)", async () => {
			const primary = new FakeLlmProvider(
				ok(okResponse),
				err(new LlmInvalidResponseError("schema mismatch")),
			);
			const secondary = new FakeLlmProvider(
				ok(okResponse),
				ok({
					object: { ok: true },
					usage: { inputTokens: 0, outputTokens: 0 },
				}),
			);

			const fallback = new FallbackLlmProviderAdapter([primary, secondary]);
			const result = await fallback.completeStructured({
				messages: [],
				schema: {},
			});

			expect(result.ok).toBe(false);
			if (!result.ok)
				expect(result.error).toBeInstanceOf(LlmInvalidResponseError);
			expect(secondary.completeStructuredCalls).toBe(0);
		});
	});
});
