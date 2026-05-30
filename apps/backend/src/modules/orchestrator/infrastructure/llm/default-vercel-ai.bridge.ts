import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, jsonSchema, tool } from "ai";

import type {
	LlmProviderType,
	VercelAiBridge,
	VercelGenerateObjectParams,
	VercelGenerateObjectResult,
	VercelGenerateTextParams,
	VercelGenerateTextResult,
} from "./llm-provider.types";

/**
 * Selects the right Vercel AI provider factory. Kept inline (no class) — the
 * bridge is stateless; clients are recreated per call. If we ever measure that
 * createX() allocation is hot, memoize here.
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

/**
 * Default bridge: forwards directly to Vercel AI SDK. The adapter never imports
 * `ai` directly — only this bridge does, which makes the rest of the adapter
 * testable without `mock.module`.
 */
export const defaultVercelAiBridge: VercelAiBridge = {
	async generateText(
		params: VercelGenerateTextParams,
	): Promise<VercelGenerateTextResult> {
		const model = selectModel(params.provider, params.apiKey, params.model);

		const tools = params.tools
			? Object.fromEntries(
					params.tools.map((t) => [
						t.name,
						tool({
							description: t.description,
							inputSchema: jsonSchema(t.parameters),
						}),
					]),
				)
			: undefined;

		const result = await generateText({
			model,
			...(params.system !== undefined ? { system: params.system } : {}),
			messages: params.messages,
			...(tools !== undefined ? { tools } : {}),
			temperature: params.temperature,
			abortSignal: params.abortSignal,
		} as Parameters<typeof generateText>[0]);

		return {
			text: result.text,
			toolCalls: result.toolCalls?.map((tc) => ({
				toolName: tc.toolName,
				input: tc.input,
			})),
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

		// `schema` is opaque to the domain; the caller passes a Zod schema (or
		// anything `generateObject` accepts). We cast at the call site to keep
		// the SDK overloads from leaking into our bridge contract.
		const result = await generateObject({
			model,
			...(params.system !== undefined ? { system: params.system } : {}),
			messages: params.messages,
			schema: params.schema,
			temperature: params.temperature,
			abortSignal: params.abortSignal,
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
