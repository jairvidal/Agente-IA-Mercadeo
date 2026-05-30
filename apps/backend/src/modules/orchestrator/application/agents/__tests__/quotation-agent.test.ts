import { beforeEach, describe, expect, it } from "bun:test";

import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import {
	KnowledgeBaseUnavailableError,
	type LlmError,
	LlmInvalidResponseError,
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

import { QUOTATION_AGENT_TOOLS } from "@/modules/orchestrator/domain/constants";

import { QuotationAgent } from "../quotation-agent";

class FakeKnowledgeBase implements KnowledgeBasePort {
	faqResult: Result<string, KnowledgeBaseUnavailableError> = ok("FAQ CATALOG");
	systemPromptResult: Result<string, KnowledgeBaseUnavailableError> =
		ok("LEGACY PROMPT");
	agentPromptResult: Result<string, KnowledgeBaseUnavailableError> =
		ok("QUOTATION AGENT PROMPT");

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
	text: "quiero cotizar 50 toneladas de varilla 1/2",
	receivedAt: new Date("2026-05-27T00:00:00.000Z"),
	metadata: { chatId: 42 },
};

interface Harness {
	agent: QuotationAgent;
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
	const agent = new QuotationAgent({
		llm,
		agentTools: tools,
		knowledgeBase: kb,
		allowedTools: new Set(overrides.allowedTools ?? QUOTATION_AGENT_TOOLS),
		maxIterations: overrides.maxIterations ?? 5,
	});
	return { agent, kb, llm, tools };
}

describe("QuotationAgent", () => {
	let h: Harness;

	beforeEach(() => {
		h = buildHarness();
	});

	it("identifies itself as 'quotation'", () => {
		expect(h.agent.name).toBe("quotation");
	});

	it("resolves the FAQ catalog and the quotation-specific system prompt before running the loop", async () => {
		h.llm.completeResults = [
			ok({ content: "ok", usage: { inputTokens: 1, outputTokens: 1 } }),
		];

		await h.agent.run({ message, history: [] });

		expect(h.kb.getFaqCatalogCalls).toBe(1);
		expect(h.kb.agentPromptCalls).toEqual([
			{ agent: "quotation", args: { context: "FAQ CATALOG" } },
		]);

		const firstCall = h.llm.completeCalls[0]!;
		expect(firstCall.messages[0]).toEqual({
			role: "system",
			content: "QUOTATION AGENT PROMPT",
		});
	});

	it("runs process_quote and returns the LLM's follow-up content", async () => {
		h.llm.completeResults = [
			ok({
				content: "procesando",
				toolCalls: [
					{
						name: "process_quote",
						arguments: {
							product: "varilla 1/2",
							quantity: 50,
							location: "Cali",
							contact_name: "Juan",
							company_name: "Acme",
						},
					},
				],
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
			ok({
				content: "Cotización registrada con ticket TICKET-XYZ",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];
		h.tools.invokeResults = [ok("TICKET-XYZ")];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(true);
		expect(h.tools.invokeCalls).toHaveLength(1);
		expect(h.tools.invokeCalls[0]!.name).toBe("process_quote");
		if (result.ok) expect(result.value.text).toContain("TICKET-XYZ");
	});

	it("filters tool calls outside the allowlist (e.g. search_faq)", async () => {
		// QuotationAgent's allowlist is process_quote only — search_faq must be dropped.
		h.llm.completeResults = [
			ok({
				content: "respuesta sin tool",
				toolCalls: [{ name: "search_faq", arguments: { query: "horario" } }],
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(true);
		expect(h.tools.invokeCalls).toHaveLength(0);
		if (result.ok) expect(result.value.text).toBe("respuesta sin tool");
	});

	it("retries on a transient LlmTimeoutError and recovers on the next iteration", async () => {
		h.llm.completeResults = [
			err(new LlmTimeoutError(30_000)),
			ok({
				content: "recovered",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.text).toBe("recovered");
		expect(h.llm.completeCalls).toHaveLength(2);
	});

	it("returns err immediately on LlmInvalidResponseError", async () => {
		h.llm.completeResults = [
			err(new LlmInvalidResponseError("schema mismatch")),
		];

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBeInstanceOf(LlmInvalidResponseError);
	});

	it("returns err when max_iterations is exceeded", async () => {
		const toolCallResp = ok({
			content: "thinking",
			toolCalls: [{ name: "process_quote", arguments: { foo: 1 } }],
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

	it("returns err when the KB FAQ catalog is unavailable", async () => {
		h.kb.faqResult = err(new KnowledgeBaseUnavailableError("getFaqCatalog"));

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(result.error).toBeInstanceOf(KnowledgeBaseUnavailableError);
		expect(h.llm.completeCalls).toHaveLength(0);
	});

	it("returns err when the KB agent system prompt is unavailable", async () => {
		h.kb.agentPromptResult = err(
			new KnowledgeBaseUnavailableError("getAgentSystemPrompt:quotation"),
		);

		const result = await h.agent.run({ message, history: [] });

		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(result.error).toBeInstanceOf(KnowledgeBaseUnavailableError);
		expect(h.llm.completeCalls).toHaveLength(0);
	});
});
