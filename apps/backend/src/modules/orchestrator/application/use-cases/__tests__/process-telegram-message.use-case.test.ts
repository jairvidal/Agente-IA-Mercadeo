import { beforeEach, describe, expect, it } from "bun:test";

import type { AgentRegistry } from "@/modules/orchestrator/application/agents/agent-registry";
import type { IntentClassifier } from "@/modules/orchestrator/application/services/intent-classifier.service";
import type {
	ConsentResult,
	HandleHabeasDataConsentUseCase,
} from "@/modules/orchestrator/application/use-cases/handle-habeas-data-consent.use-case";
import type { AgentReply } from "@/modules/orchestrator/domain/entities/agent-reply";
import type { ChannelType } from "@/modules/orchestrator/domain/entities/channel";
import type {
	Category,
	Classification,
} from "@/modules/orchestrator/domain/entities/classification";
import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { OutgoingReply } from "@/modules/orchestrator/domain/entities/outgoing-reply";
import type { ConversationTurn, Session } from "@/modules/orchestrator/domain/entities/session";
import {
	KnowledgeBaseUnavailableError,
	type LlmError,
	LlmInvalidResponseError,
	LlmProviderUnavailableError,
	LlmTimeoutError,
	SessionRepositoryError,
} from "@/modules/orchestrator/domain/errors";
import type {
	AgentError,
	AgentPort,
	AgentRunContext,
} from "@/modules/orchestrator/domain/ports/agent.port";
import type { AgentName } from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import type {
	LlmStructuredRequest,
	LlmStructuredResponse,
} from "@/modules/orchestrator/domain/ports/llm-provider.port";
import type { MessageChannelPort } from "@/modules/orchestrator/domain/ports/message-channel.port";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import { ProcessTelegramMessageUseCase } from "../process-telegram-message.use-case";

// ---------------------------------------------------------------------------
// Fakes
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

	async getOrCreate(_userId: string, _channel: ChannelType): Promise<Result<Session, never>> {
		return ok(this.session);
	}

	async appendTurn(
		session: Session,
		turn: Omit<ConversationTurn, "timestamp">,
	): Promise<Result<Session, never>> {
		this.session = {
			...session,
			history: [...session.history, { ...turn, timestamp: new Date("2026-05-27T00:00:00.000Z") }],
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

	// Satisfies the structural shape — not used here.
	async completeStructured<T>(_req: LlmStructuredRequest<unknown>) {
		return ok({
			object: {} as T,
			usage: { inputTokens: 0, outputTokens: 0 },
		}) as Result<LlmStructuredResponse<T>, LlmError>;
	}
}

class FakeAgent implements AgentPort {
	runCalls: AgentRunContext[] = [];
	runResults: Array<Result<AgentReply, AgentError>> = [];

	constructor(readonly name: AgentName) {}

	async run(ctx: AgentRunContext): Promise<Result<AgentReply, AgentError>> {
		this.runCalls.push(ctx);
		return this.runResults.shift() ?? ok({ text: `default ${this.name}`, metadata: {} });
	}
}

/**
 * Fake for the consent gate. Default behavior is "consent already resolved"
 * (handled=false), which means existing routing/persistence tests can keep
 * exercising the post-consent flow without any per-test wiring.
 */
class FakeConsentUseCase implements Pick<HandleHabeasDataConsentUseCase, "execute"> {
	executeCalls: Array<{ session: Session; messageText: string }> = [];
	results: Array<Result<ConsentResult, SessionRepositoryError>> = [];

	async execute(
		session: Session,
		messageText: string,
	): Promise<Result<ConsentResult, SessionRepositoryError>> {
		this.executeCalls.push({ session, messageText });
		const next = this.results.shift();
		if (next) return next;
		return ok({ handled: false, session });
	}
}

class FakeRegistry implements AgentRegistry {
	resolveCalls: Category[] = [];

	constructor(
		private readonly faq: AgentPort,
		private readonly quotation: AgentPort,
	) {}

	resolve(category: Category): AgentPort | null {
		this.resolveCalls.push(category);
		if (category === "commercial_faq") return this.faq;
		if (category === "commercial_quotation") return this.quotation;
		return null;
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
	classifier: FakeIntentClassifier;
	faq: FakeAgent;
	quotation: FakeAgent;
	registry: FakeRegistry;
	consent: FakeConsentUseCase;
}

function buildHarness(overrides: { sessionInit?: Partial<Session> } = {}): Harness {
	const sessions = new FakeSessionRepository(overrides.sessionInit);
	const channel = new FakeChannel();
	const classifier = new FakeIntentClassifier();
	const faq = new FakeAgent("faq");
	const quotation = new FakeAgent("quotation");
	const registry = new FakeRegistry(faq, quotation);
	const consent = new FakeConsentUseCase();

	const useCase = new ProcessTelegramMessageUseCase({
		channel,
		sessions,
		classifier,
		registry,
		consent: consent as unknown as HandleHabeasDataConsentUseCase,
	});

	return {
		useCase,
		sessions,
		channel,
		classifier,
		faq,
		quotation,
		registry,
		consent,
	};
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

describe("ProcessTelegramMessageUseCase (routing)", () => {
	let h: Harness;

	beforeEach(() => {
		h = buildHarness();
	});

	it("classifies the message before resolving the agent", async () => {
		h.classifier.results = [classificationOk("commercial_faq")];
		h.faq.runResults = [ok({ text: "ok", metadata: {} })];

		await h.useCase.execute(message);

		expect(h.classifier.classifyCalls).toHaveLength(1);
		expect(h.classifier.classifyCalls[0]!.message).toBe(message.text);
	});

	it("dispatches commercial_faq to the FAQ agent", async () => {
		h.classifier.results = [classificationOk("commercial_faq")];
		h.faq.runResults = [ok({ text: "Cali abre 8am-6pm", metadata: {} })];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.faq.runCalls).toHaveLength(1);
		expect(h.quotation.runCalls).toHaveLength(0);
		expect(h.channel.sent[0]!.text).toBe("Cali abre 8am-6pm");
	});

	it("dispatches commercial_quotation to the Quotation agent", async () => {
		h.classifier.results = [classificationOk("commercial_quotation")];
		h.quotation.runResults = [
			ok({ text: "Para cotizar necesito producto y cantidad", metadata: {} }),
		];

		const result = await h.useCase.execute({
			...message,
			text: "quiero cotizar 50 toneladas",
		});

		expect(result.ok).toBe(true);
		expect(h.quotation.runCalls).toHaveLength(1);
		expect(h.faq.runCalls).toHaveLength(0);
		expect(h.channel.sent[0]!.text).toContain("cotizar");
	});

	it("dispatches non_commercial to a static derivation reply without calling any agent", async () => {
		h.classifier.results = [classificationOk("non_commercial")];

		const result = await h.useCase.execute({
			...message,
			text: "soy proveedor y quiero ofrecer servicios",
		});

		expect(result.ok).toBe(true);
		expect(h.faq.runCalls).toHaveLength(0);
		expect(h.quotation.runCalls).toHaveLength(0);
		const reply = h.channel.sent[0]!.text;
		expect(reply).toMatch(/\+57|664-4717|asesor|contact/i);
	});

	it("falls back when the classifier itself errors out — does not dispatch", async () => {
		h.classifier.results = [err(new LlmProviderUnavailableError("classify"))];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.faq.runCalls).toHaveLength(0);
		expect(h.quotation.runCalls).toHaveLength(0);
		expect(h.channel.sent[0]!.text).toContain("asesor humano");
	});

	it("passes session.history (without the current user message) to the agent", async () => {
		const ts = new Date("2026-05-27T00:00:00.000Z");
		const h2 = buildHarness({
			sessionInit: {
				history: [
					{ role: "user", content: "¿horario tienda Cali?", timestamp: ts },
					{ role: "assistant", content: "Cali abre 8am-6pm", timestamp: ts },
				],
			},
		});
		h2.classifier.results = [classificationOk("commercial_faq")];
		h2.faq.runResults = [ok({ text: "tel +57", metadata: {} })];

		await h2.useCase.execute({ ...message, text: "y el teléfono?" });

		const ctx = h2.faq.runCalls[0]!;
		expect(ctx.history).toHaveLength(2);
		expect(ctx.message.text).toBe("y el teléfono?");
	});

	it("passes session.history to the classifier so anaphoric references can be resolved", async () => {
		const ts = new Date("2026-05-27T00:00:00.000Z");
		const h2 = buildHarness({
			sessionInit: {
				history: [
					{ role: "user", content: "¿horario tienda Cali?", timestamp: ts },
					{ role: "assistant", content: "Cali abre 8am-6pm", timestamp: ts },
				],
			},
		});
		h2.classifier.results = [classificationOk("commercial_faq")];
		h2.faq.runResults = [ok({ text: "ok", metadata: {} })];

		await h2.useCase.execute({ ...message, text: "y el teléfono?" });

		expect(h2.classifier.classifyCalls[0]!.historyLength).toBe(2);
	});
});

describe("ProcessTelegramMessageUseCase (agent error mapping)", () => {
	let h: Harness;

	beforeEach(() => {
		h = buildHarness();
	});

	it("maps KnowledgeBaseUnavailableError -> kb_unavailable fallback", async () => {
		h.classifier.results = [classificationOk("commercial_faq")];
		h.faq.runResults = [err(new KnowledgeBaseUnavailableError("getFaqCatalog"))];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.channel.sent[0]!.text).toContain("asesor humano");
	});

	it("maps LlmInvalidResponseError -> llm_invalid_response fallback", async () => {
		h.classifier.results = [classificationOk("commercial_faq")];
		h.faq.runResults = [err(new LlmInvalidResponseError("schema mismatch"))];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.channel.sent[0]!.text).toContain("asesor humano");
	});

	it("maps LlmTimeoutError (cap reached) -> llm_unavailable fallback", async () => {
		h.classifier.results = [classificationOk("commercial_quotation")];
		h.quotation.runResults = [err(new LlmTimeoutError(30_000))];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.channel.sent[0]!.text).toContain("asesor humano");
	});
});

describe("ProcessTelegramMessageUseCase (session persistence)", () => {
	it("appends both user and assistant turns to the session", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("commercial_faq")];
		h.faq.runResults = [ok({ text: "direct reply", metadata: {} })];

		await h.useCase.execute(message);

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			const roles = sessionAfter.value.history.map((t) => t.role);
			expect(roles).toEqual(["user", "assistant"]);
		}
	});

	it("persists session.metadata.lastAgent after a commercial_faq turn", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("commercial_faq")];
		h.faq.runResults = [ok({ text: "ok", metadata: {} })];

		await h.useCase.execute(message);

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			expect(sessionAfter.value.metadata.lastAgent).toBe("faq");
		}
	});

	it("persists session.metadata.lastAgent after a commercial_quotation turn", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("commercial_quotation")];
		h.quotation.runResults = [ok({ text: "ok", metadata: {} })];

		await h.useCase.execute(message);

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			expect(sessionAfter.value.metadata.lastAgent).toBe("quotation");
		}
	});

	it("does NOT set lastAgent for non_commercial turns", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("non_commercial")];

		await h.useCase.execute({
			...message,
			text: "soy proveedor",
		});

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			expect(sessionAfter.value.metadata.lastAgent).toBeUndefined();
		}
	});
});

describe("ProcessTelegramMessageUseCase (clarification flow)", () => {
	it("on first not_understood: asks for clarification and sets clarificationAttempts=1", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("not_understood")];

		const result = await h.useCase.execute({ ...message, text: "asdf" });

		expect(result.ok).toBe(true);
		expect(h.faq.runCalls).toHaveLength(0);
		expect(h.quotation.runCalls).toHaveLength(0);
		const reply = h.channel.sent[0]!.text;
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
		expect(h.channel.sent[0]!.text.toLowerCase()).toMatch(/aclar|reformul|entend|detalle/);
	});

	it("after 2 failed attempts: offers human advisor and resets counter", async () => {
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
		h.faq.runResults = [ok({ text: "ok", metadata: {} })];

		await h.useCase.execute(message);

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			expect(sessionAfter.value.metadata.clarificationAttempts).toBe(0);
		}
	});
});

describe("ProcessTelegramMessageUseCase (Habeas Data consent gate)", () => {
	it("short-circuits when consent handles the turn: no classify, no agents, single send", async () => {
		const h = buildHarness();
		const ts = new Date("2026-05-27T00:00:00.000Z");
		const sessionFromConsent: Session = {
			id: "sess-1",
			channel: "telegram",
			userId: "u-1",
			history: [],
			metadata: { awaitingHabeasConsent: true },
			createdAt: ts,
			updatedAt: ts,
			expiresAt: new Date(ts.getTime() + 86_400_000),
		};
		h.consent.results = [
			ok({
				handled: true,
				response: "consent prompt text",
				session: sessionFromConsent,
			}),
		];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.consent.executeCalls).toHaveLength(1);
		expect(h.classifier.classifyCalls).toHaveLength(0);
		expect(h.faq.runCalls).toHaveLength(0);
		expect(h.quotation.runCalls).toHaveLength(0);
		expect(h.channel.sent).toHaveLength(1);
		expect(h.channel.sent[0]!.text).toBe("consent prompt text");
		expect(h.channel.sent[0]!.metadata.chatId).toBe(42);
	});

	it("persists user + assistant turns when consent handles the turn", async () => {
		const h = buildHarness();
		const ts = new Date("2026-05-27T00:00:00.000Z");
		const sessionFromConsent: Session = {
			id: "sess-1",
			channel: "telegram",
			userId: "u-1",
			history: [],
			metadata: { awaitingHabeasConsent: true },
			createdAt: ts,
			updatedAt: ts,
			expiresAt: new Date(ts.getTime() + 86_400_000),
		};
		h.consent.results = [
			ok({
				handled: true,
				response: "consent prompt text",
				session: sessionFromConsent,
			}),
		];

		await h.useCase.execute(message);

		const sessionAfter = await h.sessions.getOrCreate("u-1", "telegram");
		expect(sessionAfter.ok).toBe(true);
		if (sessionAfter.ok) {
			const roles = sessionAfter.value.history.map((t) => t.role);
			expect(roles).toEqual(["user", "assistant"]);
			expect(sessionAfter.value.history[0]!.content).toBe(message.text);
			expect(sessionAfter.value.history[1]!.content).toBe("consent prompt text");
		}
	});

	it("continues the normal flow when consent returns handled=false", async () => {
		const h = buildHarness();
		h.classifier.results = [classificationOk("commercial_faq")];
		h.faq.runResults = [ok({ text: "ok", metadata: {} })];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(true);
		expect(h.consent.executeCalls).toHaveLength(1);
		expect(h.classifier.classifyCalls).toHaveLength(1);
		expect(h.faq.runCalls).toHaveLength(1);
	});

	it("propagates SessionRepositoryError from the consent gate", async () => {
		const h = buildHarness();
		h.consent.results = [err(new SessionRepositoryError("updateMetadata"))];

		const result = await h.useCase.execute(message);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toBeInstanceOf(SessionRepositoryError);
		expect(h.classifier.classifyCalls).toHaveLength(0);
		expect(h.channel.sent).toHaveLength(0);
	});
});
