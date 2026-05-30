import { describe, expect, it } from "bun:test";

import type { Classification } from "@/modules/orchestrator/domain/entities/classification";
import {
	type LlmError,
	LlmInvalidResponseError,
	LlmProviderUnavailableError,
} from "@/modules/orchestrator/domain/errors";
import type {
	LlmCompletionRequest,
	LlmCompletionResponse,
	LlmProviderPort,
	LlmStructuredRequest,
	LlmStructuredResponse,
} from "@/modules/orchestrator/domain/ports/llm-provider.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import { IntentClassifierService } from "../intent-classifier.service";

class FakeLlmProvider implements LlmProviderPort {
	structuredCalls: LlmStructuredRequest<unknown>[] = [];
	structuredResults: Array<Result<LlmStructuredResponse<unknown>, LlmError>> =
		[];

	async complete(
		_req: LlmCompletionRequest,
	): Promise<Result<LlmCompletionResponse, LlmError>> {
		throw new Error("not used");
	}

	async completeStructured<T>(
		req: LlmStructuredRequest<unknown>,
	): Promise<Result<LlmStructuredResponse<T>, LlmError>> {
		this.structuredCalls.push(req);
		const next = this.structuredResults.shift();
		if (!next) {
			throw new Error("no structured result queued");
		}
		return next as Result<LlmStructuredResponse<T>, LlmError>;
	}
}

const classification = (overrides: Partial<Classification> = {}): Classification => ({
	category: "commercial_faq",
	confidence: 0.92,
	reasoning: "El usuario pregunta por horarios de una tienda",
	...overrides,
});

describe("IntentClassifierService", () => {
	it("returns the LLM's structured Classification on the happy path", async () => {
		const llm = new FakeLlmProvider();
		llm.structuredResults = [
			ok({
				object: classification(),
				usage: { inputTokens: 50, outputTokens: 20 },
			}),
		];
		const classifier = new IntentClassifierService({ llm });

		const result = await classifier.classify("¿Cuál es el horario en Cali?", []);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.category).toBe("commercial_faq");
			expect(result.value.confidence).toBeGreaterThan(0);
		}
		expect(llm.structuredCalls).toHaveLength(1);
	});

	it("forwards LlmError from the provider unchanged", async () => {
		const llm = new FakeLlmProvider();
		llm.structuredResults = [
			err(new LlmProviderUnavailableError("completeStructured")),
		];
		const classifier = new IntentClassifierService({ llm });

		const result = await classifier.classify("hola", []);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeInstanceOf(LlmProviderUnavailableError);
		}
	});

	it("forwards LlmInvalidResponseError when schema validation fails downstream", async () => {
		const llm = new FakeLlmProvider();
		llm.structuredResults = [
			err(new LlmInvalidResponseError("schema mismatch")),
		];
		const classifier = new IntentClassifierService({ llm });

		const result = await classifier.classify("???", []);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeInstanceOf(LlmInvalidResponseError);
		}
	});

	it("includes the user message and the 4 category identifiers in the prompt", async () => {
		const llm = new FakeLlmProvider();
		llm.structuredResults = [
			ok({
				object: classification({ category: "non_commercial" }),
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];
		const classifier = new IntentClassifierService({ llm });

		await classifier.classify("necesito hablar con contabilidad", []);

		const call = llm.structuredCalls[0]!;
		const joined = call.messages.map((m) => m.content).join("\n");
		expect(joined).toContain("necesito hablar con contabilidad");
		expect(joined).toContain("commercial_faq");
		expect(joined).toContain("commercial_quotation");
		expect(joined).toContain("non_commercial");
		expect(joined).toContain("not_understood");
	});

	it("includes recent conversation history when provided so anaphoric refs classify well", async () => {
		const llm = new FakeLlmProvider();
		llm.structuredResults = [
			ok({
				object: classification(),
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];
		const classifier = new IntentClassifierService({ llm });

		await classifier.classify("y el teléfono?", [
			{
				role: "user",
				content: "¿horario tienda Cali?",
				timestamp: new Date("2026-05-27T00:00:00Z"),
			},
			{
				role: "assistant",
				content: "Cali abre 8am-6pm",
				timestamp: new Date("2026-05-27T00:00:01Z"),
			},
		]);

		const call = llm.structuredCalls[0]!;
		const joined = call.messages.map((m) => m.content).join("\n");
		expect(joined).toContain("tienda Cali");
		expect(joined).toContain("y el teléfono?");
	});

	it("uses a low temperature for deterministic classification", async () => {
		const llm = new FakeLlmProvider();
		llm.structuredResults = [
			ok({
				object: classification(),
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];
		const classifier = new IntentClassifierService({ llm });

		await classifier.classify("hola", []);

		const call = llm.structuredCalls[0]!;
		expect(call.temperature).toBeDefined();
		expect(call.temperature).toBeLessThanOrEqual(0.2);
	});

	it("passes a schema to the provider so generateObject can enforce the shape", async () => {
		const llm = new FakeLlmProvider();
		llm.structuredResults = [
			ok({
				object: classification(),
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];
		const classifier = new IntentClassifierService({ llm });

		await classifier.classify("hola", []);

		const call = llm.structuredCalls[0]!;
		expect(call.schema).toBeDefined();
	});
});
