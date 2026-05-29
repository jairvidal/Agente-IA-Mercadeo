import { beforeEach, describe, expect, it } from "bun:test";

import type { IntentClassifier } from "@/modules/orchestrator/application/services/intent-classifier.service";
import type {
	Category,
	Classification,
} from "@/modules/orchestrator/domain/entities/classification";
import type { ChannelType } from "@/modules/orchestrator/domain/entities/channel";
import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { OutgoingReply } from "@/modules/orchestrator/domain/entities/outgoing-reply";
import type {
	ConversationTurn,
	Session,
} from "@/modules/orchestrator/domain/entities/session";
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
import type { MessageChannelPort } from "@/modules/orchestrator/domain/ports/message-channel.port";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import { ProcessTelegramMessageUseCase } from "../process-telegram-message.use-case";

// ---------------------------------------------------------------------------
// Fakes — inline-per-test pattern, mirror of FakeMcpClient / FakeRedisClient.
// ---------------------------------------------------------------------------

class FakeSessionRepository implements SessionRepositoryPort {
	private session: Session;

	constructor(initial?: Partial<Session>) {
		const now = new Date("2026-05-27T00:00:00.000Z");
		this.session = {
			id: "sess-1",
			channel: "telegram",
			userId: "u-1",
			history: [],
			metadata: {},
			createdAt: now,
			updatedAt: now,
			expiresAt: new Date(now.getTime() + 86_400_000),
			...initial,
		};
	}

	async getOrCreate(
		_userId: string,
		_channel: ChannelType,
	): Promise<Result<Session, never>> {
		return ok(this.session);
	}

	async appendTurn(
		session: Session,
		turn: Omit<ConversationTurn, "timestamp">,
	): Promise<Result<Session, never>> {
		this.session = {
			...session,
			history: [
				...session.history,
				{ ...turn, timestamp: new Date("2026-05-27T00:00:00.000Z") },
			],
		};
		return ok(this.session);
	}

	async updateMetadata(
		session: Session,
		metadata: Record<string, unknown>,
	): Promise<Result<Session, never>> {
		this.session = { ...session, metadata };
		return ok(this.session);
	}
}

class FakeChannel implements MessageChannelPort {
	sent: OutgoingReply[] = [];

	async send(reply: OutgoingReply): Promise<Result<void, never>> {
		this.sent.push(reply);
		return ok(undefined);
	}
}

class FakeKnowledgeBase implements KnowledgeBasePort {
	faqResult: Result<string, KnowledgeBaseUnavailableError> = ok("FAQ CATALOG");
	promptResult: Result<string, KnowledgeBaseUnavailableError> =
		ok("SYSTEM PROMPT");
	systemPromptCalls: SystemPromptArgs[] = [];

	async getFaqCatalog(): Promise<
		Result<string, KnowledgeBaseUnavailableError>
	> {
		return this.faqResult;
	}

	async getSystemPrompt(
		args: SystemPromptArgs,
	): Promise<Result<string, KnowledgeBaseUnavailableError>> {
		this.systemPromptCalls.push(args);
		return this.promptResult;
	}
}

class FakeLlmProvider implements LlmProviderPort {
	completeCalls: LlmCompletionRequest[] = [];
	completeResults: Array<Result<LlmCompletionResponse, LlmError>> = [];
	completeStructuredResults: Array<
		Result<LlmStructuredResponse<unknown>, LlmError>
	> = [];

	async complete(
		req: LlmCompletionRequest,
	): Promise<Result<LlmCompletionResponse, LlmError>> {
		this.completeCalls.push(req);
		const next =
			this.completeResults.shift() ??
			ok({
				content: "default",
				usage: { inputTokens: 0, outputTokens: 0 },
			});
		return next;
	}

	async completeStructured<T>(
		_req: LlmStructuredRequest<unknown>,
	): Promise<Result<LlmStructuredResponse<T>, LlmError>> {
		const next =
			this.completeStructuredResults.shift() ??
			ok({ object: {}, usage: { inputTokens: 0, outputTokens: 0 } });
		return next as Result<LlmStructuredResponse<T>, LlmError>;
	}
}

class FakeAgentTools implements AgentToolPort {
	invokeCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
	invokeResults: Array<Result<string, ToolInvocationError>> = [];

	async invoke(
		name: string,
		args: Record<string, unknown>,
	): Promise<Result<string, ToolInvocationError>> {
		this.invokeCalls.push({ name, args });
		return this.invokeResults.shift() ?? ok("default-tool-result");
	}
}

class FakeIntentClassifier implements IntentClassifier {
	classifyCalls: Array<{ message: string; historyLength: number }> = [];
	results: Array<Result<Classification, LlmError>> = [];
	defaultCategory: Category = "commercial_faq";

	async classify(
		userMessage: string,
		history: ConversationTurn[],
	): Promise<Result<Classification, LlmError>> {
		this.classifyCalls.push({
			message: userMessage,
			historyLength: history.length,
		});
		const next = this.results.shift();
		if (next) return next;
		return ok({
			category: this.defaultCategory,
			confidence: 0.95,
			reasoning: "default test stub",
		});
	}
}

function classificationOk(category: Category): Result<Classification, never> {
	return ok({ category, confidence: 0.95, reasoning: `test ${category}` });
}

// ---------------------------------------------------------------------------
// Test wiring
// ---------------------------------------------------------------------------

interface Harness {
	useCase: ProcessTelegramMessageUseCase;
	sessions: FakeSessionRepository;
	channel: FakeChannel;
	kb: FakeKnowledgeBase;
	llm: FakeLlmProvider;
	tools: FakeAgentTools;
	classifier: FakeIntentClassifier;
}

function buildHarness(
	overrides: {
		allowedTools?: readonly string[];
		sessionInit?: Partial<Session>;
		maxIterations?: number;
	} = {},
): Harness {
	const sessions = new FakeSessionRepository(overrides.sessionInit);
	const channel = new FakeChannel();
	const kb = new FakeKnowledgeBase();
	const llm = new FakeLlmProvider();
	const tools = new FakeAgentTools();
	const classifier = new FakeIntentClassifier();

	const useCase = new ProcessTelegramMessageUseCase({
		channel,
		sessions,
		knowledgeBase: kb,
		llm,
		agentTools: tools,
		classifier,
		allowedTools: overrides.allowedTools ?? ["search_faq", "process_quote"],
		maxIterations: overrides.maxIterations ?? 5,
	});

	return { useCase, sessions, channel, kb, llm, tools, classifier };
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

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

describe("ProcessTelegramMessageUseCase (agentic loop)", () => {
	let h: Harness;

	beforeEach(() => {
		h = buildHarness();
	});

	it("replies directly when the LLM returns content with no tool calls", async () => {
		h.llm.completeResults = [
			ok({
				content: "Cali abre 8am-6pm",
				usage: { inputTokens: 10, outputTokens: 5 },
			}),
		];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.channel.sent).toHaveLength(1);
		expect(h.channel.sent[0]!.text).toBe("Cali abre 8am-6pm");
		expect(h.llm.completeCalls).toHaveLength(1);
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

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.tools.invokeCalls).toEqual([
			{ name: "search_faq", args: { query: "horario" } },
		]);
		expect(h.channel.sent[0]!.text).toBe("Cali abre 8am-6pm");

		// Second LLM call should include the tool result in the message thread.
		const secondCall = h.llm.completeCalls[1]!;
		const toolResultMsg = secondCall.messages.find((m) =>
			m.content.startsWith("[Tool result for search_faq]"),
		);
		expect(toolResultMsg).toBeDefined();
		expect(toolResultMsg?.content).toContain("Horario Cali: 8am-6pm");
	});

	it("drops tool calls that are not in the allowlist and replies with the LLM content", async () => {
		h.llm.completeResults = [
			ok({
				content: "respuesta sin tool",
				toolCalls: [
					{ name: "delete_database", arguments: {} },
					{ name: "rm_rf", arguments: {} },
				],
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.tools.invokeCalls).toHaveLength(0);
		expect(h.channel.sent[0]!.text).toBe("respuesta sin tool");
	});

	it("returns the fallback reply when MAX_ITERATIONS is exceeded", async () => {
		// Every iteration: tool call that is in the allowlist (so the loop never
		// exits on direct response) — 6 calls would be needed; supply that many.
		const toolCallResp = ok({
			content: "thinking",
			toolCalls: [{ name: "search_faq", arguments: { q: "x" } }],
			usage: { inputTokens: 1, outputTokens: 1 },
		}) as Result<LlmCompletionResponse, LlmError>;
		h.llm.completeResults = Array.from({ length: 10 }, () => toolCallResp);
		h.tools.invokeResults = Array.from({ length: 10 }, () => ok("..."));

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.channel.sent[0]!.text).toContain("asesor humano");
		// 5 iterations attempted, no more.
		expect(h.llm.completeCalls).toHaveLength(5);
	});

	it("returns the fallback reply when the LLM returns LlmTimeoutError on the last iteration", async () => {
		// Use a 1-iteration harness so the timeout in the only attempt hits the cap.
		const h1 = buildHarness({ allowedTools: ["search_faq"], maxIterations: 1 });
		h1.llm.completeResults = [err(new LlmTimeoutError(30_000))];

		const result = await h1.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h1.channel.sent[0]!.text).toContain("asesor humano");
	});

	it("retries on a transient LlmTimeoutError and recovers on the next iteration", async () => {
		h.llm.completeResults = [
			err(new LlmTimeoutError(30_000)),
			ok({
				content: "recovered",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.channel.sent[0]!.text).toBe("recovered");
		expect(h.llm.completeCalls).toHaveLength(2);
	});

	it("uses fallback reply when KB returns Err — does NOT call the LLM", async () => {
		h.kb.faqResult = err(new KnowledgeBaseUnavailableError("getFaqCatalog"));

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.llm.completeCalls).toHaveLength(0);
		expect(h.channel.sent[0]!.text).toContain("asesor humano");
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

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.channel.sent[0]!.text).toBe("I could not find that info");

		// The second LLM call should see the tool error injected as a user message.
		const secondCall = h.llm.completeCalls[1]!;
		const errMsg = secondCall.messages.find((m) =>
			m.content.startsWith("[Tool error for search_faq]"),
		);
		expect(errMsg).toBeDefined();
	});

	it("returns fallback immediately on LlmInvalidResponseError without retrying", async () => {
		h.llm.completeResults = [
			err(new LlmInvalidResponseError("schema mismatch")),
			// This should never be consumed:
			ok({
				content: "should not see this",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.channel.sent[0]!.text).toContain("asesor humano");
		expect(h.llm.completeCalls).toHaveLength(1);
	});

	it("returns fallback when the LLM returns LlmProviderUnavailableError", async () => {
		h.llm.completeResults = [err(new LlmProviderUnavailableError("complete"))];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.channel.sent[0]!.text).toContain("asesor humano");
	});

	it("appends both user and assistant turns to the session", async () => {
		h.llm.completeResults = [
			ok({
				content: "direct reply",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		await h.useCase.execute(message);

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			const roles = sessionAfter.value.history.map((t) => t.role);
			expect(roles).toEqual(["user", "assistant"]);
		}
	});
});

describe("ProcessTelegramMessageUseCase (E-02 dispatch)", () => {
	it("classifies the message before running the agentic loop", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("commercial_faq")];
		h.llm.completeResults = [
			ok({ content: "ok", usage: { inputTokens: 1, outputTokens: 1 } }),
		];

		await h.useCase.execute(message);

		expect(h.classifier.classifyCalls).toHaveLength(1);
		expect(h.classifier.classifyCalls[0]!.message).toBe(message.text);
	});

	it("dispatches commercial_faq to the agentic loop", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("commercial_faq")];
		h.llm.completeResults = [
			ok({
				content: "Cali abre 8am-6pm",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.llm.completeCalls).toHaveLength(1);
		expect(h.channel.sent[0]!.text).toBe("Cali abre 8am-6pm");
	});

	it("dispatches commercial_quotation to the agentic loop", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("commercial_quotation")];
		h.llm.completeResults = [
			ok({
				content: "Para cotizar necesito el producto y la cantidad",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		const result = await h.useCase.execute({
			...message,
			text: "quiero cotizar 50 toneladas de varilla 1/2",
		});

		expect(result.ok).toBe(true);
		expect(h.llm.completeCalls).toHaveLength(1);
		expect(h.channel.sent[0]!.text).toContain("cotizar");
	});

	it("dispatches non_commercial to a static derivation reply without calling the LLM", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("non_commercial")];

		const result = await h.useCase.execute({
			...message,
			text: "soy proveedor y quiero ofrecer servicios",
		});

		expect(result.ok).toBe(true);
		// Classifier ran, but no agentic loop LLM call followed.
		expect(h.classifier.classifyCalls).toHaveLength(1);
		expect(h.llm.completeCalls).toHaveLength(0);
		// Reply mentions a contact/phone so the user can be derived.
		const reply = h.channel.sent[0]!.text;
		expect(reply.length).toBeGreaterThan(0);
		expect(reply).toMatch(/\+57|664-4717|asesor|contact/i);
	});

	it("falls back when the classifier itself errors out", async () => {
		const h = buildHarness();
		h.classifier.results = [err(new LlmProviderUnavailableError("classify"))];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.llm.completeCalls).toHaveLength(0);
		expect(h.channel.sent[0]!.text).toContain("asesor humano");
	});

	it("answers non_commercial even when the KB is down (KB only needed for commercial paths)", async () => {
		const h = buildHarness();
		h.kb.faqResult = err(new KnowledgeBaseUnavailableError("getFaqCatalog"));
		h.classifier.results = [classificationOk("non_commercial")];

		await h.useCase.execute({
			...message,
			text: "soy proveedor",
		});

		expect(h.classifier.classifyCalls).toHaveLength(1);
		expect(h.llm.completeCalls).toHaveLength(0);
		// Non-commercial doesn't need KB → user still gets routed.
		expect(h.channel.sent[0]!.text).toMatch(/664-4717|asesor/i);
	});
});

describe("ProcessTelegramMessageUseCase (E-02 clarification flow)", () => {
	it("on first not_understood: asks for clarification and sets clarificationAttempts=1", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("not_understood")];

		const result = await h.useCase.execute({ ...message, text: "asdf" });

		expect(result.ok).toBe(true);
		expect(h.llm.completeCalls).toHaveLength(0);
		const reply = h.channel.sent[0]!.text;
		expect(reply.length).toBeGreaterThan(0);
		expect(reply.toLowerCase()).toMatch(/aclar|reformul|entend|detalle/);

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			expect(sessionAfter.value.metadata.clarificationAttempts).toBe(1);
		}
	});

	it("on second not_understood: asks again and increments counter to 2", async () => {
		const h = buildHarness({
			sessionInit: { metadata: { clarificationAttempts: 1 } },
		});
		h.classifier.results = [classificationOk("not_understood")];

		await h.useCase.execute({ ...message, text: "??" });

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			expect(sessionAfter.value.metadata.clarificationAttempts).toBe(2);
		}
		// Still asking for clarification, not yet offering a human.
		expect(h.channel.sent[0]!.text.toLowerCase()).toMatch(
			/aclar|reformul|entend|detalle/,
		);
	});

	it("after 2 failed attempts: offers human advisor with phone and resets counter", async () => {
		const h = buildHarness({
			sessionInit: { metadata: { clarificationAttempts: 2 } },
		});
		h.classifier.results = [classificationOk("not_understood")];

		await h.useCase.execute({ ...message, text: "no entiendo nada" });

		const reply = h.channel.sent[0]!.text;
		expect(reply).toMatch(/\+57|664-4717/);
		expect(reply.toLowerCase()).toContain("asesor");

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			expect(sessionAfter.value.metadata.clarificationAttempts).toBe(0);
		}
	});

	it("resets the clarification counter when classification succeeds with a non not_understood category", async () => {
		const h = buildHarness({
			sessionInit: { metadata: { clarificationAttempts: 2 } },
		});
		h.classifier.results = [classificationOk("commercial_faq")];
		h.llm.completeResults = [
			ok({ content: "Cali 8am-6pm", usage: { inputTokens: 1, outputTokens: 1 } }),
		];

		await h.useCase.execute(message);

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			expect(sessionAfter.value.metadata.clarificationAttempts).toBe(0);
		}
	});
});

describe("ProcessTelegramMessageUseCase (E-03 conversation continuity)", () => {
	it("interleaves session.history between the system prompt and the current user message", async () => {
		const ts = new Date("2026-05-27T00:00:00.000Z");
		const h = buildHarness({
			sessionInit: {
				history: [
					{ role: "user", content: "¿horario tienda Cali?", timestamp: ts },
					{ role: "assistant", content: "Cali abre 8am-6pm", timestamp: ts },
				],
			},
		});
		h.classifier.results = [classificationOk("commercial_faq")];
		h.llm.completeResults = [
			ok({
				content: "+57 (602) 555-0001",
				usage: { inputTokens: 1, outputTokens: 1 },
			}),
		];

		await h.useCase.execute({ ...message, text: "y el teléfono?" });

		const call = h.llm.completeCalls[0]!;
		const roles = call.messages.map((m) => m.role);
		expect(roles).toEqual(["system", "user", "assistant", "user"]);
		const contents = call.messages.map((m) => m.content);
		expect(contents[1]).toBe("¿horario tienda Cali?");
		expect(contents[2]).toBe("Cali abre 8am-6pm");
		expect(contents[3]).toBe("y el teléfono?");
	});

	it("does not duplicate the current user message in the history seen by the LLM", async () => {
		const ts = new Date("2026-05-27T00:00:00.000Z");
		const h = buildHarness({
			sessionInit: {
				history: [
					{ role: "user", content: "primero", timestamp: ts },
					{ role: "assistant", content: "ok", timestamp: ts },
				],
			},
		});
		h.classifier.results = [classificationOk("commercial_faq")];
		h.llm.completeResults = [
			ok({ content: "respuesta", usage: { inputTokens: 1, outputTokens: 1 } }),
		];

		await h.useCase.execute({ ...message, text: "segundo" });

		const call = h.llm.completeCalls[0]!;
		const userTurns = call.messages.filter(
			(m) => m.role === "user" && m.content === "segundo",
		);
		expect(userTurns).toHaveLength(1);
	});

	it("works with an empty history on the very first turn (no extra messages)", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("commercial_faq")];
		h.llm.completeResults = [
			ok({ content: "hola", usage: { inputTokens: 1, outputTokens: 1 } }),
		];

		await h.useCase.execute(message);

		const call = h.llm.completeCalls[0]!;
		expect(call.messages.map((m) => m.role)).toEqual(["system", "user"]);
		expect(call.messages[1]!.content).toBe(message.text);
	});

	it("passes session.history to the classifier so anaphoric references can be resolved", async () => {
		const ts = new Date("2026-05-27T00:00:00.000Z");
		const h = buildHarness({
			sessionInit: {
				history: [
					{ role: "user", content: "¿horario tienda Cali?", timestamp: ts },
					{ role: "assistant", content: "Cali abre 8am-6pm", timestamp: ts },
				],
			},
		});
		h.classifier.results = [classificationOk("commercial_faq")];
		h.llm.completeResults = [
			ok({ content: "ok", usage: { inputTokens: 1, outputTokens: 1 } }),
		];

		await h.useCase.execute({ ...message, text: "y el teléfono?" });

		// Classifier should see the previous 2 turns (without the current user message,
		// which is passed separately to classifier.classify()).
		expect(h.classifier.classifyCalls[0]!.historyLength).toBe(2);
	});
});
