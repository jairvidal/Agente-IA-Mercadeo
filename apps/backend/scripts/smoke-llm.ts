import { z } from "zod";

import {
	LlmInvalidResponseError,
	LlmProviderUnavailableError,
	LlmRateLimitError,
	LlmTimeoutError,
} from "@/modules/orchestrator/domain/errors";
import { VercelLlmProviderAdapter } from "@/modules/orchestrator/infrastructure/llm/vercel-llm-provider.adapter";
import type { LlmProviderType } from "@/modules/orchestrator/infrastructure/llm/llm-provider.types";

const PROVIDER = (Bun.env.LLM_PROVIDER ?? "gemini") as LlmProviderType;
const MODEL = Bun.env.LLM_MODEL ?? "gemini-2.5-flash-lite";

function resolveApiKey(provider: LlmProviderType): string | undefined {
	switch (provider) {
		case "gemini":
			return Bun.env.GOOGLE_API_KEY;
		case "openai":
			return Bun.env.OPENAI_API_KEY;
		case "anthropic":
			return Bun.env.ANTHROPIC_API_KEY;
	}
}

function describeError(error: unknown): string {
	if (!(error instanceof Error)) return String(error);
	const parts = [`${error.name}: ${error.message}`];
	const cause = (error as { cause?: unknown }).cause;
	if (cause instanceof Error) {
		parts.push(`  cause: ${cause.name}: ${cause.message}`);
		const inner = (cause as { cause?: unknown }).cause;
		if (inner instanceof Error) parts.push(`    inner: ${inner.name}: ${inner.message}`);
	} else if (cause !== undefined) {
		parts.push(`  cause: ${String(cause)}`);
	}
	return parts.join("\n");
}

const apiKey = resolveApiKey(PROVIDER);
if (!apiKey) {
	console.error(`[smoke] Missing API key for provider "${PROVIDER}"`);
	process.exit(1);
}

console.log(`[smoke] provider=${PROVIDER} model=${MODEL}\n`);

const adapter = new VercelLlmProviderAdapter({
	provider: PROVIDER,
	model: MODEL,
	apiKey,
});

let failures = 0;

// ─── Check 1: completeText ────────────────────────────────────────────
console.log("[1/3] complete() — basic text generation + usage mapping");
const r1 = await adapter.complete({
	messages: [{ role: "user", content: "Say hello in one short sentence." }],
});
if (!r1.ok) {
	console.error(`  FAIL: ${describeError(r1.error)}`);
	failures++;
} else {
	console.log(`  text:  "${r1.value.content.trim()}"`);
	console.log(`  usage: input=${r1.value.usage.inputTokens} output=${r1.value.usage.outputTokens}`);
	if (r1.value.usage.inputTokens === 0 || r1.value.usage.outputTokens === 0) {
		console.error("  FAIL: token usage is 0 — ai@6 inputTokens/outputTokens mapping is broken");
		failures++;
	} else {
		console.log("  ✓ pass");
	}
}

// ─── Check 2: completeStructured with Zod schema ──────────────────────
console.log("\n[2/3] completeStructured() — Zod schema validation (E-02 unblocks on this)");
const greetingSchema = z.object({
	greeting: z.string().min(1),
	tone: z.enum(["formal", "casual"]),
});
type Greeting = z.infer<typeof greetingSchema>;

const r2 = await adapter.completeStructured<Greeting>({
	messages: [
		{
			role: "user",
			content: "Generate a casual greeting in Spanish. Respond using the schema.",
		},
	],
	schema: greetingSchema,
});
if (!r2.ok) {
	console.error(`  FAIL: ${describeError(r2.error)}`);
	failures++;
} else {
	const parsed = greetingSchema.safeParse(r2.value.object);
	if (!parsed.success) {
		console.error("  FAIL: returned object does not match schema:", parsed.error.message);
		failures++;
	} else {
		console.log(`  object: ${JSON.stringify(r2.value.object)}`);
		console.log(`  usage:  input=${r2.value.usage.inputTokens} output=${r2.value.usage.outputTokens}`);
		console.log("  ✓ pass");
	}
}

// ─── Check 3: tool calling in the agentic loop ────────────────────────
console.log("\n[3/3] complete() with tool — verify model invokes the declared tool");
const r3 = await adapter.complete({
	messages: [
		{
			role: "system",
			content:
				"You are a helpful assistant. When the user asks about the current time, you MUST call the get_current_time tool to get it. Do not guess.",
		},
		{ role: "user", content: "What time is it right now?" },
	],
	tools: [
		{
			name: "get_current_time",
			description: "Returns the current ISO-8601 timestamp in UTC. Use this whenever the user asks about the current time.",
			parameters: {
				type: "object",
				properties: {},
				required: [],
				additionalProperties: false,
			},
		},
	],
});
if (!r3.ok) {
	console.error(`  FAIL: ${describeError(r3.error)}`);
	failures++;
} else {
	console.log(`  text:      "${r3.value.content.trim() || "<empty — model deferred to tool>"}"`);
	console.log(`  toolCalls: ${JSON.stringify(r3.value.toolCalls ?? [])}`);
	console.log(`  usage:     input=${r3.value.usage.inputTokens} output=${r3.value.usage.outputTokens}`);
	if (!r3.value.toolCalls || r3.value.toolCalls.length === 0) {
		console.warn("  ⚠ WARN: model did NOT invoke the tool. Tool-calling contract may need stricter prompting,");
		console.warn("          or Gemini Flash-Lite ignored the affordance. Not a hard failure but worth flagging.");
	} else if (r3.value.toolCalls[0]?.name !== "get_current_time") {
		console.error(`  FAIL: model called an unexpected tool: ${r3.value.toolCalls[0]?.name}`);
		failures++;
	} else {
		console.log("  ✓ pass");
	}
}

console.log("");
if (failures > 0) {
	console.error(`[smoke] ${failures} check(s) failed`);
	process.exit(1);
}
console.log("[smoke] all checks passed ✅");
