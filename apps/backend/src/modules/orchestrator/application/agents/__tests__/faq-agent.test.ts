import { beforeEach, describe, expect, it } from "bun:test";

import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { ConversationTurn } from "@/modules/orchestrator/domain/entities/session";
import {
	KnowledgeBaseUnavailableError,
	type LlmError,
	LlmInvalidResponseError,
	LlmProviderUnavailableError,
	LlmTimeoutError,
	ToolInvocationError,
} from "@/modules/orchestrator/domain/errors";
import type { AgentToolPort } from "@/modules/orchestrator/domain/ports/agent-tool.port";
import type {
	AgentName,
	KnowledgeBasePort,
	SystemPromptArgs,
} from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import type {
	LlmCompletionRequest,
	LlmCompletionResponse,
	LlmProviderPort,
	LlmStructuredRequest,
	LlmStructuredResponse,
} from "@/modules/orchestrator/domain/ports/llm-provider.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import { FAQ_AGENT_TOOLS } from "@/modules/orchestrator/domain/constants";

import { FaqAgent } from "../faq-agent";

// ---------------------------------------------------------------------------
// Inline fakes — same shape as the ones in use case tests so future devs can
// move them to a shared file if duplication becomes painful (not yet).
// ---------------------------------------------------------------------------

class FakeKnowledgeBase implements KnowledgeBasePort {
	faqResult: Result<string, KnowledgeBaseUnavailableError> = ok("FAQ CATALOG");
	systemPromptResult: Result<string, KnowledgeBaseUnavailableError> =
		ok("LEGACY PROMPT");
	agentPromptResult: Result<string, KnowledgeBaseUnavailableError> =
		ok("FAQ AGENT PROMPT");

	getFaqCatalogCalls = 0;
	systemPromptCalls: SystemPromptArgs[] = [];
	agentPromptCalls: Array<{ agent: AgentName; args: SystemPromptArgs }> = [];

	async getFaqCatalog() {
		this.getFaqCatalogCalls++;
		return this.faqResult;
	}
	async getSystemPrompt(args: SystemPromptArgs) {
		this.systemPromptCalls.push(args);
		return this.systemPromptResult;
	}
	async getAgentSystemPrompt(agent: AgentName, args: SystemPromptArgs) {
		this.agentPromptCalls.push({ agent, args });
		return this.agentPromptResult;
	}
}

class FakeLlmProvider implements LlmProviderPort {
	completeCalls: LlmCompletionRequest[] = [];
	completeResults: Array<Result<LlmCompletionResponse, LlmError>> = [];

	async complete(req: LlmCompletionRequest) {
		this.completeCalls.push(req);
		return (
			this.completeResults.shift() ??
			ok({ content: "default", usage: { inputTokens: 0, outputTokens: 0 } })
		);
	}
	async completeStructured<T>(_req: LlmStructuredRequest<unknown>) {
		return ok({
			object: {} as T,
			usage: { inputTokens: 0, outputTokens: 0 },
		}) as Result<LlmStructuredResponse<T>, LlmError>;
	}
}

class FakeAgentTools implements AgentToolPort {
	invokeCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
	invokeResults: Array<Result<string, ToolInvocationError>> = [];

	async invoke(name: string, args: Record<string, unknown>) {
		this.invokeCalls.push({ name, args });
		return this.invokeResults.shift() ?? ok("default-tool-result");
	}
}

const message: IncomingMessage = {
	id: "msg-1",
	channel: "telegram",
	userId: "u-1",
	sessionId: "sess-1",
	text: "¿cuál es el horario en Cali?",
	receivedAt: new Date("2026-05-27T00:00:00.000Z"),
	metadata: { chatId: 42 },
};

interface Harness {
	agent: FaqAgent;
	kb: FakeKnowledgeBase;
	llm: FakeLlmProvider;
	tools: FakeAgentTools;
}

function buildHarness(
	overrides: { maxIterations?: number; allowedTools?: readonly string[] } = {},
): Harness {
	const kb = new FakeKnowledgeBase();
	const llm = new FakeLlmProvider();
	const tools = new FakeAgentTools();
	const agent = new FaqAgent({
		llm,
		agentTools: tools,
		knowledgeBase: kb,
		allowedTools: new Set(overrides.allowedTools ?? FAQ_AGENT_TOOLS),
		maxIterations: overrides.maxIterations ?? 5,
	});
	return { agent, kb, llm, tools };
}

describe("FaqAgent", () => {
	let h: Harness;

	beforeEach(() => {
		h = buildHarness();
	});

	it("identifies itself as 'faq'", () => {
		expect(h.agent.name).toBe("faq");
	});

	it("resolves the FAQ catalog and the faq-specific system prompt before running the loop", async () => {
		h.llm.completeResults = [
			ok({ content: "ok", usage: { inputTokens: 1, outputTokens: 1 } }),
		];

		await h.agent.run({ message, history: [] });

		expect(h.kb.getFaqCatalogCalls).toBe(1);
		expect(h.kb.agentPromptCalls).toEqual([
			{ agent: "faq", args: { context: "FAQ CATALOG" } },
		]);
		expect(h.kb.systemPromptCalls).toHaveLength(0);

		const firstCall = h.llm.completeCalls[0]!;
		expect(firstCall.messages[0]).toEqual({
			role: "system",
			content: "FAQ AGENT PROMPT",
		});
	});

	it("replies directly when the LLM returns content with no tool calls", async () => {
		h.llm.completeResults = [
			ok({
				content: "Cali abre 8am-6pm",
				usage: { inputTokens: 10, outputTokens: 5 },
			}),
		];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.text).toBe("Cali abre 8am-6pm");
			expect(result.value.metadata.intent).toBe("direct_response");
		}
	});

	it("runs one tool call and returns the LLM's follow-up content", async () => {
		h.llm.completeResults = [
			ok({
				content: "let me check",
				toolCalls: [{ name: "search_faq", arguments: { query: "horario" } }],
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
			ok({
				content: "Cali abre 8am-6pm",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];
		h.tools.invokeResults = [ok("Horario Cali: 8am-6pm")];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(true);
		expect(h.tools.invokeCalls).toEqual([
			{ name: "search_faq", args: { query: "horario" } },
		]);
		if (result.ok) expect(result.value.text).toBe("Cali abre 8am-6pm");

		const secondCall = h.llm.completeCalls[1]!;
		const toolResultMsg = secondCall.messages.find((m) =>
			m.content.startsWith("[Tool result for search_faq]"),
		);
		expect(toolResultMsg).toBeDefined();
		expect(toolResultMsg?.content).toContain("Horario Cali: 8am-6pm");
	});

	it("filters tool calls outside the allowlist (e.g. process_quote)", async () => {
		h.llm.completeResults = [
			ok({
				content: "respuesta sin tool",
				toolCalls: [
					{ name: "process_quote", arguments: {} },
					{ name: "delete_database", arguments: {} },
				],
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(true);
		expect(h.tools.invokeCalls).toHaveLength(0);
		if (result.ok) expect(result.value.text).toBe("respuesta sin tool");
	});

	it("inlines a tool error and lets the LLM react on the next iteration", async () => {
		h.llm.completeResults = [
			ok({
				content: "let me check",
				toolCalls: [{ name: "search_faq", arguments: {} }],
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
			ok({
				content: "I could not find that info",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];
		h.tools.invokeResults = [err(new ToolInvocationError("search_faq"))];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.text).toBe("I could not find that info");

		const secondCall = h.llm.completeCalls[1]!;
		const errMsg = secondCall.messages.find((m) =>
			m.content.startsWith("[Tool error for search_faq]"),
		);
		expect(errMsg).toBeDefined();
	});

	it("retries on a transient LlmTimeoutError and recovers on the next iteration", async () => {
		h.llm.completeResults = [
			err(new LlmTimeoutError(30_000)),
			ok({ content: "recovered", usage: { inputTokens: 1, outputTokens: 1 } }),
		];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.text).toBe("recovered");
		expect(h.llm.completeCalls).toHaveLength(2);
	});

	it("returns err on LlmTimeoutError when the cap is reached", async () => {
		const h1 = buildHarness({ maxIterations: 1 });
		h1.llm.completeResults = [err(new LlmTimeoutError(30_000))];

		const result = await h1.agent.run({ message, history: [] });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBeInstanceOf(LlmTimeoutError);
	});

	it("returns err immediately on LlmInvalidResponseError without retrying", async () => {
		h.llm.completeResults = [
			err(new LlmInvalidResponseError("schema mismatch")),
			ok({
				content: "should not see this",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBeInstanceOf(LlmInvalidResponseError);
		expect(h.llm.completeCalls).toHaveLength(1);
	});

	it("returns err on LlmProviderUnavailableError without retrying", async () => {
		h.llm.completeResults = [err(new LlmProviderUnavailableError("complete"))];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(result.error).toBeInstanceOf(LlmProviderUnavailableError);
	});

	it("returns err when max_iterations is exceeded", async () => {
		const toolCallResp = ok({
			content: "thinking",
			toolCalls: [{ name: "search_faq", arguments: { q: "x" } }],
			usage: { inputTokens: 1, outputTokens: 1 },
		}) as Result<LlmCompletionResponse, LlmError>;
		h.llm.completeResults = Array.from({ length: 10 }, () => toolCallResp);
		h.tools.invokeResults = Array.from({ length: 10 }, () => ok("..."));

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeInstanceOf(LlmInvalidResponseError);
			expect(result.error.message).toContain("max_iterations_exceeded");
		}
		expect(h.llm.completeCalls).toHaveLength(5);
	});

	it("returns err when the KB FAQ catalog is unavailable — does NOT call the LLM", async () => {
		h.kb.faqResult = err(new KnowledgeBaseUnavailableError("getFaqCatalog"));

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(result.error).toBeInstanceOf(KnowledgeBaseUnavailableError);
		expect(h.llm.completeCalls).toHaveLength(0);
	});

	it("returns err when the KB agent system prompt is unavailable — does NOT call the LLM", async () => {
		h.kb.agentPromptResult = err(
			new KnowledgeBaseUnavailableError("getAgentSystemPrompt:faq"),
		);

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(result.error).toBeInstanceOf(KnowledgeBaseUnavailableError);
		expect(h.llm.completeCalls).toHaveLength(0);
	});

	it("interleaves history between the system prompt and the current user message", async () => {
		const ts = new Date("2026-05-27T00:00:00.000Z");
		const history: ConversationTurn[] = [
			{ role: "user", content: "¿horario tienda Cali?", timestamp: ts },
			{ role: "assistant", content: "Cali abre 8am-6pm", timestamp: ts },
		];
		h.llm.completeResults = [
			ok({
				content: "+57 (602) 555-0001",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		await h.agent.run({
			message: { ...message, text: "y el teléfono?" },
			history,
		});

		const call = h.llm.completeCalls[0]!;
		expect(call.messages.map((m) => m.role)).toEqual([
			"system",
			"user",
			"assistant",
			"user",
		]);
		const contents = call.messages.map((m) => m.content);
		expect(contents[1]).toBe("¿horario tienda Cali?");
		expect(contents[2]).toBe("Cali abre 8am-6pm");
		expect(contents[3]).toBe("y el teléfono?");
	});

	it("does not duplicate the current user message when history is empty", async () => {
		h.llm.completeResults = [
			ok({ content: "hola", usage: { inputTokens: 1, outputTokens: 1 } }),
		];

		await h.agent.run({ message, history: [] });

		const call = h.llm.completeCalls[0]!;
		expect(call.messages.map((m) => m.role)).toEqual(["system", "user"]);
		expect(call.messages[1]!.content).toBe(message.text);
	});
});
