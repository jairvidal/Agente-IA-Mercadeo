import { beforeEach, describe, expect, it } from "bun:test";

import {
	LlmInvalidResponseError,
	LlmProviderUnavailableError,
	LlmRateLimitError,
	LlmTimeoutError,
} from "@/modules/orchestrator/domain/errors";
import type {
	VercelAiBridge,
	VercelGenerateObjectParams,
	VercelGenerateObjectResult,
	VercelGenerateTextParams,
	VercelGenerateTextResult,
} from "../llm-provider.types";
import { VercelLlmProviderAdapter } from "../vercel-llm-provider.adapter";

class FakeVercelAiBridge implements VercelAiBridge {
	generateTextCalls: VercelGenerateTextParams[] = [];
	generateObjectCalls: VercelGenerateObjectParams[] = [];

	generateTextImpl: (
		params: VercelGenerateTextParams,
	) => Promise<VercelGenerateTextResult> = async () => ({
		text: "default",
		usage: { inputTokens: 1, outputTokens: 1 },
	});

	generateObjectImpl: (
		params: VercelGenerateObjectParams,
	) => Promise<VercelGenerateObjectResult<unknown>> = async () => ({
		object: {},
		usage: { inputTokens: 1, outputTokens: 1 },
	});

	async generateText(
		params: VercelGenerateTextParams,
	): Promise<VercelGenerateTextResult> {
		this.generateTextCalls.push(params);
		return this.generateTextImpl(params);
	}

	async generateObject<T>(
		params: VercelGenerateObjectParams,
	): Promise<VercelGenerateObjectResult<T>> {
		this.generateObjectCalls.push(params);
		const result = await this.generateObjectImpl(params);
		return result as VercelGenerateObjectResult<T>;
	}
}

/**
 * Builds a structurally-compatible AI_RetryError. We do NOT import the SDK
 * class because the adapter must rely on shape (`name`, `lastError`, `errors`),
 * not on a `instanceof` check — that's what the runtime crash exposed.
 */
function makeAiRetryError(lastError: unknown): Error {
	const message =
		lastError instanceof Error
			? `Failed after 3 attempts. Last error: ${lastError.message}`
			: "Failed after 3 attempts.";
	const err = new Error(message);
	err.name = "AI_RetryError";
	Object.assign(err, {
		reason: "maxRetriesExceeded",
		errors: [lastError],
		lastError,
	});
	return err;
}

function makeAdapter(bridge: VercelAiBridge): VercelLlmProviderAdapter {
	return new VercelLlmProviderAdapter(
		{
			provider: "gemini",
			model: "gemini-2.0-flash-lite",
			apiKey: "test-key",
			defaultTemperature: 0.3,
			defaultTimeoutMs: 30_000,
		},
		{ bridge },
	);
}

describe("VercelLlmProviderAdapter", () => {
	let bridge: FakeVercelAiBridge;
	let llm: VercelLlmProviderAdapter;

	beforeEach(() => {
		bridge = new FakeVercelAiBridge();
		llm = makeAdapter(bridge);
	});

	describe("complete()", () => {
		it("forwards messages, tools and temperature to the bridge on Ok", async () => {
			bridge.generateTextImpl = async () => ({
				text: "hello",
				usage: { inputTokens: 10, outputTokens: 5 },
			});

			const result = await llm.complete({
				messages: [
					{ role: "system", content: "you are a bot" },
					{ role: "user", content: "hi" },
				],
				tools: [
					{
						name: "search_faq",
						description: "search the FAQ",
						parameters: { type: "object", properties: {} },
					},
				],
				temperature: 0.7,
			});

			expect(result.ok).toBe(true);
			expect(bridge.generateTextCalls).toHaveLength(1);
			const call = bridge.generateTextCalls[0]!;
			expect(call.provider).toBe("gemini");
			expect(call.model).toBe("gemini-2.0-flash-lite");
			expect(call.apiKey).toBe("test-key");
			expect(call.temperature).toBe(0.7);
			expect(call.system).toBe("you are a bot");
			expect(call.messages).toEqual([{ role: "user", content: "hi" }]);
			expect(call.tools).toEqual([
				{
					name: "search_faq",
					description: "search the FAQ",
					parameters: { type: "object", properties: {} },
				},
			]);
		});

		it("maps result.usage to LlmUsage", async () => {
			bridge.generateTextImpl = async () => ({
				text: "ok",
				usage: { inputTokens: 42, outputTokens: 7 },
			});

			const result = await llm.complete({ messages: [] });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.usage.inputTokens).toBe(42);
				expect(result.value.usage.outputTokens).toBe(7);
			}
		});

		it("maps result.toolCalls to LlmToolCall[]", async () => {
			bridge.generateTextImpl = async () => ({
				text: "",
				toolCalls: [
					{ toolName: "search_faq", input: { query: "horario" } },
					{ toolName: "process_quote", input: { product: "x" } },
				],
				usage: { inputTokens: 1, outputTokens: 1 },
			});

			const result = await llm.complete({ messages: [] });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolCalls).toEqual([
					{ name: "search_faq", arguments: { query: "horario" } },
					{ name: "process_quote", arguments: { product: "x" } },
				]);
			}
		});

		it("returns empty/undefined toolCalls when the bridge returns none", async () => {
			bridge.generateTextImpl = async () => ({
				text: "no tools",
				usage: { inputTokens: 1, outputTokens: 1 },
			});

			const result = await llm.complete({ messages: [] });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.toolCalls).toBeUndefined();
			}
		});

		it("maps AbortError from the bridge to Err(LlmTimeoutError) with the configured timeout", async () => {
			bridge.generateTextImpl = async () => {
				const e = new Error("aborted");
				e.name = "AbortError";
				throw e;
			};

			const result = await llm.complete({ messages: [], timeoutMs: 1234 });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmTimeoutError);
				if (result.error instanceof LlmTimeoutError) {
					expect(result.error.timeoutMs).toBe(1234);
				}
			}
		});

		it("maps a 429-shaped error to Err(LlmRateLimitError) with retryAfterMs when present", async () => {
			bridge.generateTextImpl = async () => {
				throw Object.assign(new Error("too many requests"), {
					statusCode: 429,
					retryAfterMs: 5000,
				});
			};

			const result = await llm.complete({ messages: [] });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmRateLimitError);
				if (result.error instanceof LlmRateLimitError) {
					expect(result.error.retryAfterMs).toBe(5000);
				}
			}
		});

		it("maps any other error to Err(LlmProviderUnavailableError('complete', cause))", async () => {
			const cause = new Error("connection refused");
			bridge.generateTextImpl = async () => {
				throw cause;
			};

			const result = await llm.complete({ messages: [] });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmProviderUnavailableError);
				expect(result.error.message).toContain("complete");
				expect(result.error.cause).toBe(cause);
			}
		});

		it("never throws — even when the bridge throws a non-Error value", async () => {
			bridge.generateTextImpl = async () => {
				// biome-ignore lint/suspicious/noExplicitAny: deliberate
				throw "string error" as any;
			};

			// If this throws, the test will fail explicitly.
			const result = await llm.complete({ messages: [] });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmProviderUnavailableError);
			}
		});

		it("unwraps AI_RetryError wrapping a 429 into Err(LlmRateLimitError)", async () => {
			const inner = Object.assign(new Error("Quota exceeded"), {
				statusCode: 429,
				retryAfterMs: 56_565,
			});
			bridge.generateTextImpl = async () => {
				throw makeAiRetryError(inner);
			};

			const result = await llm.complete({ messages: [] });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmRateLimitError);
				if (result.error instanceof LlmRateLimitError) {
					expect(result.error.retryAfterMs).toBe(56_565);
				}
			}
		});

		it("regression: real-shape AI_RetryError from ai@6 (errors[] only, no retryAfterMs)", async () => {
			// Reproduces the runtime crash from the smoke test: Gemini free tier
			// 429 wrapped by ai@6's retry-with-exponential-backoff after 3 tries.
			// Only `errors[]` is reliable — older SDK versions did not set
			// `lastError`. The mapper must fall back to errors[errors.length-1].
			const apiError = Object.assign(
				new Error(
					"You exceeded your current quota, please check your plan and billing details.",
				),
				{ statusCode: 429, isRetryable: true },
			);
			const retryError = new Error(
				"Failed after 3 attempts. Last error: You exceeded your current quota...",
			);
			retryError.name = "AI_RetryError";
			Object.assign(retryError, {
				reason: "maxRetriesExceeded",
				errors: [apiError, apiError, apiError],
			});

			bridge.generateTextImpl = async () => {
				throw retryError;
			};

			const result = await llm.complete({ messages: [] });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmRateLimitError);
			}
		});

		it("keeps non-429 AI_RetryError mapped to LlmProviderUnavailableError", async () => {
			const inner = new Error("connection reset");
			bridge.generateTextImpl = async () => {
				throw makeAiRetryError(inner);
			};

			const result = await llm.complete({ messages: [] });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmProviderUnavailableError);
			}
		});

		it("extracts retryAfterMs from APICallError responseHeaders 'retry-after' seconds", async () => {
			const inner = Object.assign(new Error("rate limit"), {
				statusCode: 429,
				responseHeaders: { "retry-after": "57" },
			});
			bridge.generateTextImpl = async () => {
				throw makeAiRetryError(inner);
			};

			const result = await llm.complete({ messages: [] });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmRateLimitError);
				if (result.error instanceof LlmRateLimitError) {
					expect(result.error.retryAfterMs).toBe(57_000);
				}
			}
		});

		it("extracts system messages and passes them as the `system` param", async () => {
			bridge.generateTextImpl = async () => ({
				text: "ok",
				usage: { inputTokens: 1, outputTokens: 1 },
			});

			await llm.complete({
				messages: [
					{ role: "system", content: "you are a bot" },
					{ role: "user", content: "hi" },
				],
			});

			const call = bridge.generateTextCalls[0]!;
			expect(call.system).toBe("you are a bot");
			expect(call.messages).toEqual([{ role: "user", content: "hi" }]);
		});

		it("concatenates multiple system messages with `\\n\\n`", async () => {
			await llm.complete({
				messages: [
					{ role: "system", content: "first" },
					{ role: "system", content: "second" },
					{ role: "user", content: "hi" },
				],
			});

			const call = bridge.generateTextCalls[0]!;
			expect(call.system).toBe("first\n\nsecond");
			expect(call.messages).toEqual([{ role: "user", content: "hi" }]);
		});

		it("omits the `system` param when there are no system messages", async () => {
			await llm.complete({
				messages: [{ role: "user", content: "hi" }],
			});

			const call = bridge.generateTextCalls[0]!;
			expect(call.system).toBeUndefined();
			expect(call.messages).toEqual([{ role: "user", content: "hi" }]);
		});
	});

	describe("completeStructured()", () => {
		it("returns Ok with { object, usage } and forwards the schema", async () => {
			const schema = { __zod: true };
			bridge.generateObjectImpl = async () => ({
				object: { intent: "faq", confidence: 0.9 },
				usage: { inputTokens: 12, outputTokens: 3 },
			});

			const result = await llm.completeStructured<{
				intent: string;
				confidence: number;
			}>({ messages: [{ role: "user", content: "horario?" }], schema });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.object).toEqual({ intent: "faq", confidence: 0.9 });
				expect(result.value.usage).toEqual({
					inputTokens: 12,
					outputTokens: 3,
				});
			}
			expect(bridge.generateObjectCalls[0]!.schema).toBe(schema);
		});

		it("maps a ZodError-shaped failure to Err(LlmInvalidResponseError)", async () => {
			bridge.generateObjectImpl = async () => {
				throw Object.assign(new Error("schema mismatch"), { name: "ZodError" });
			};

			const result = await llm.completeStructured({
				messages: [],
				schema: {},
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmInvalidResponseError);
			}
		});

		it("maps AI_NoObjectGeneratedError to Err(LlmInvalidResponseError)", async () => {
			bridge.generateObjectImpl = async () => {
				throw Object.assign(new Error("no object generated"), {
					name: "AI_NoObjectGeneratedError",
				});
			};

			const result = await llm.completeStructured({
				messages: [],
				schema: {},
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmInvalidResponseError);
			}
		});

		it("maps AbortError to Err(LlmTimeoutError)", async () => {
			bridge.generateObjectImpl = async () => {
				const e = new Error("aborted");
				e.name = "AbortError";
				throw e;
			};

			const result = await llm.completeStructured({
				messages: [],
				schema: {},
				timeoutMs: 500,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmTimeoutError);
				if (result.error instanceof LlmTimeoutError) {
					expect(result.error.timeoutMs).toBe(500);
				}
			}
		});

		it("maps generic errors to Err(LlmProviderUnavailableError('completeStructured'))", async () => {
			bridge.generateObjectImpl = async () => {
				throw new Error("upstream 500");
			};

			const result = await llm.completeStructured({
				messages: [],
				schema: {},
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmProviderUnavailableError);
				expect(result.error.message).toContain("completeStructured");
			}
		});

		it("unwraps AI_RetryError wrapping a 429 into Err(LlmRateLimitError)", async () => {
			const inner = Object.assign(new Error("quota exceeded"), {
				statusCode: 429,
			});
			bridge.generateObjectImpl = async () => {
				throw makeAiRetryError(inner);
			};

			const result = await llm.completeStructured({
				messages: [],
				schema: {},
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmRateLimitError);
			}
		});

		it("keeps non-429 AI_RetryError mapped to LlmProviderUnavailableError", async () => {
			const inner = new Error("upstream 503");
			bridge.generateObjectImpl = async () => {
				throw makeAiRetryError(inner);
			};

			const result = await llm.completeStructured({
				messages: [],
				schema: {},
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(LlmProviderUnavailableError);
			}
		});

		it("extracts system messages and passes them as the `system` param", async () => {
			await llm.completeStructured({
				messages: [
					{ role: "system", content: "you are a classifier" },
					{ role: "user", content: "classify this" },
				],
				schema: {},
			});

			const call = bridge.generateObjectCalls[0]!;
			expect(call.system).toBe("you are a classifier");
			expect(call.messages).toEqual([
				{ role: "user", content: "classify this" },
			]);
		});

		it("omits the `system` param when there are no system messages", async () => {
			await llm.completeStructured({
				messages: [{ role: "user", content: "hi" }],
				schema: {},
			});

			const call = bridge.generateObjectCalls[0]!;
			expect(call.system).toBeUndefined();
		});
	});
});
