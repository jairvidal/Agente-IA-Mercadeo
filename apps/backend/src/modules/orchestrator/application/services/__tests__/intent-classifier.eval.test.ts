import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { describe, expect, it } from "bun:test";

import type { Category } from "@/modules/orchestrator/domain/entities/classification";
import type {
	LlmProviderType,
	VercelAiBridge,
	VercelGenerateObjectParams,
	VercelGenerateObjectResult,
	VercelGenerateTextParams,
	VercelGenerateTextResult,
} from "@/modules/orchestrator/infrastructure/llm/llm-provider.types";
import { VercelLlmProviderAdapter } from "@/modules/orchestrator/infrastructure/llm/vercel-llm-provider.adapter";

import { IntentClassifierService } from "../intent-classifier.service";

/**
 * Eval bridge: same as `defaultVercelAiBridge` but with `maxRetries: 0`.
 *
 * Why: the Vercel AI SDK retries 2x internally on transient errors. On the
 * Gemini free tier (15 RPM) a single 429 burns 3 quota slots, which makes a
 * deterministic throttle impossible. By disabling SDK retries we count exactly
 * one quota slot per logical classify() call.
 */
function selectModel(provider: LlmProviderType, apiKey: string, model: string) {
	switch (provider) {
		case "openai":
			return createOpenAI({ apiKey })(model);
		case "anthropic":
			return createAnthropic({ apiKey })(model);
		case "gemini":
			return createGoogleGenerativeAI({ apiKey })(model);
	}
}

const noRetryBridge: VercelAiBridge = {
	async generateText(
		params: VercelGenerateTextParams,
	): Promise<VercelGenerateTextResult> {
		const model = selectModel(params.provider, params.apiKey, params.model);
		const result = await generateText({
			model,
			...(params.system !== undefined ? { system: params.system } : {}),
			messages: params.messages,
			temperature: params.temperature,
			abortSignal: params.abortSignal,
			maxRetries: 0,
		} as Parameters<typeof generateText>[0]);
		return {
			text: result.text,
			usage: {
				inputTokens: result.usage.inputTokens,
				outputTokens: result.usage.outputTokens,
			},
		};
	},
	async generateObject<T>(
		params: VercelGenerateObjectParams,
	): Promise<VercelGenerateObjectResult<T>> {
		const model = selectModel(params.provider, params.apiKey, params.model);
		const result = await generateObject({
			model,
			...(params.system !== undefined ? { system: params.system } : {}),
			messages: params.messages,
			schema: params.schema,
			temperature: params.temperature,
			abortSignal: params.abortSignal,
			maxRetries: 0,
		} as Parameters<typeof generateObject>[0]);
		return {
			object: result.object as T,
			usage: {
				inputTokens: result.usage.inputTokens,
				outputTokens: result.usage.outputTokens,
			},
		};
	},
};

/**
 * E-02.4 — Accuracy eval against the real LLM.
 *
 * Gated behind `RUN_CLASSIFIER_EVAL=1` because:
 * - It needs real API keys.
 * - It costs money.
 * - It's slower than the rest of the unit suite.
 *
 * Target: ≥85% accuracy on the 20-message labeled set.
 */

interface LabeledMessage {
	text: string;
	expected: Category;
}

const LABELED_SET: readonly LabeledMessage[] = [
	// commercial_faq (6)
	{ text: "¿Cuál es el horario de la tienda de Cali?", expected: "commercial_faq" },
	{ text: "¿Dónde queda la tienda de Bogotá?", expected: "commercial_faq" },
	{ text: "qué teléfono tiene la tienda de Medellín?", expected: "commercial_faq" },
	{ text: "¿hacen domicilios?", expected: "commercial_faq" },
	{ text: "qué servicios ofrecen para construcción liviana?", expected: "commercial_faq" },
	{ text: "tienen acero figurado?", expected: "commercial_faq" },
	// commercial_quotation (5)
	{ text: "quiero cotizar 50 toneladas de varilla 1/2", expected: "commercial_quotation" },
	{ text: "necesito el precio de 200 kg de alambre", expected: "commercial_quotation" },
	{ text: "cotización de malla electrosoldada para 300 m2", expected: "commercial_quotation" },
	{ text: "me pueden cotizar perfil estructural HEA 200, 10 toneladas, despacho a Cali", expected: "commercial_quotation" },
	{ text: "deseo comprar 5 toneladas de lámina de acero, ¿cuánto vale?", expected: "commercial_quotation" },
	// non_commercial (5)
	{ text: "soy proveedor y quiero ofrecer servicios de transporte", expected: "non_commercial" },
	{ text: "tengo un reclamo por una factura mal cobrada", expected: "non_commercial" },
	{ text: "busco empleo en su empresa, dónde envío mi hoja de vida?", expected: "non_commercial" },
	{ text: "necesito hablar con contabilidad por un pago", expected: "non_commercial" },
	{ text: "vendo chatarra, con quién debo contactarme?", expected: "non_commercial" },
	// not_understood (4)
	{ text: "hola", expected: "not_understood" },
	{ text: "ok", expected: "not_understood" },
	{ text: "asdf", expected: "not_understood" },
	{ text: "tienen algo?", expected: "not_understood" },
];

const TARGET_ACCURACY = 0.85;
/**
 * Throttle between sequential classification calls. Defaults to 7s so that
 * with the no-retry bridge (1 quota slot per call) we stay under the observed
 * Gemini free-tier flash-lite cap on this account (10 RPM = 1 call per 6s,
 * with margin). Override via `EVAL_CALL_DELAY_MS=0` when running against a
 * paid tier.
 */
const DEFAULT_CALL_DELAY_MS = 7_000;

function readEnv(name: string): string | undefined {
	const v = process.env[name];
	return v && v.length > 0 ? v : undefined;
}

const shouldRun = readEnv("RUN_CLASSIFIER_EVAL") === "1";

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

describe.skipIf(!shouldRun)("IntentClassifierService — accuracy eval (real LLM)", () => {
	it(`reaches ≥${TARGET_ACCURACY * 100}% accuracy on ${LABELED_SET.length} labeled messages`, async () => {
		const provider = (readEnv("LLM_PROVIDER") ?? "gemini") as LlmProviderType;
		const model = readEnv("LLM_MODEL") ?? "gemini-2.5-flash-lite";
		const apiKey =
			provider === "gemini"
				? readEnv("GOOGLE_API_KEY")
				: provider === "openai"
					? readEnv("OPENAI_API_KEY")
					: readEnv("ANTHROPIC_API_KEY");

		if (!apiKey) {
			throw new Error(
				`Missing API key for ${provider}. Set ${provider === "gemini" ? "GOOGLE_API_KEY" : `${provider.toUpperCase()}_API_KEY`}.`,
			);
		}

		const adapter = new VercelLlmProviderAdapter(
			{
				provider,
				model,
				apiKey,
				defaultTemperature: 0.1,
				defaultTimeoutMs: 15_000,
			},
			{ bridge: noRetryBridge },
		);
		const classifier = new IntentClassifierService({ llm: adapter });

		const delayMs = Number(
			readEnv("EVAL_CALL_DELAY_MS") ?? String(DEFAULT_CALL_DELAY_MS),
		);

		const results: Array<{
			sample: LabeledMessage;
			actual: Category | null;
			ok: boolean;
			errorName?: string;
			errorMessage?: string;
		}> = [];
		for (let i = 0; i < LABELED_SET.length; i++) {
			const sample = LABELED_SET[i]!;
			const r = await classifier.classify(sample.text, []);
			if (r.ok) {
				const pass = r.value.category === sample.expected ? "✓" : "✗";
				// biome-ignore lint/suspicious/noConsole: eval visibility
				console.log(
					`[${i + 1}/${LABELED_SET.length}] ${pass} expected=${sample.expected} actual=${r.value.category} text="${sample.text}"`,
				);
				results.push({ sample, actual: r.value.category, ok: true });
			} else {
				// biome-ignore lint/suspicious/noConsole: eval visibility
				console.log(
					`[${i + 1}/${LABELED_SET.length}] ✗ ERROR ${r.error.name}: ${r.error.message} text="${sample.text}"`,
				);
				results.push({
					sample,
					actual: null,
					ok: false,
					errorName: r.error.name,
					errorMessage: r.error.message,
				});
			}
			if (i < LABELED_SET.length - 1 && delayMs > 0) {
				await sleep(delayMs);
			}
		}

		const failures = results.filter(
			(r) => !r.ok || r.actual !== r.sample.expected,
		);
		const correct = LABELED_SET.length - failures.length;
		const accuracy = correct / LABELED_SET.length;

		// Always print the summary so a partial run is debuggable even on success.
		// biome-ignore lint/suspicious/noConsole: eval visibility
		console.log(
			`\n=== EVAL SUMMARY ===\nAccuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${LABELED_SET.length}) — target ≥${(TARGET_ACCURACY * 100).toFixed(0)}%`,
		);
		if (failures.length > 0) {
			// biome-ignore lint/suspicious/noConsole: eval visibility
			console.log("Failures:");
			for (const f of failures) {
				const detail = f.ok
					? `actual=${f.actual}`
					: `ERROR=${f.errorName} (${f.errorMessage})`;
				// biome-ignore lint/suspicious/noConsole: eval visibility
				console.log(
					`  - expected=${f.sample.expected} ${detail} text="${f.sample.text}"`,
				);
			}
		}

		expect(accuracy).toBeGreaterThanOrEqual(TARGET_ACCURACY);
	}, 600_000);
});
