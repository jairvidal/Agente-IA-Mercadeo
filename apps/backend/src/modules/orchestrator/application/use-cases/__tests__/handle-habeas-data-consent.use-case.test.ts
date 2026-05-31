import { beforeEach, describe, expect, it } from "bun:test";

import type { ChannelType } from "@/modules/orchestrator/domain/entities/channel";
import type { ConversationTurn, Session } from "@/modules/orchestrator/domain/entities/session";
import { SessionRepositoryError } from "@/modules/orchestrator/domain/errors";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import { HandleHabeasDataConsentUseCase } from "../handle-habeas-data-consent.use-case";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeSessionRepository implements SessionRepositoryPort {
	updateMetadataCalls: Array<{
		session: Session;
		metadata: Record<string, unknown>;
	}> = [];
	updateMetadataResult: Result<Session, SessionRepositoryError> | null = null;

	async getOrCreate(
		_userId: string,
		_channel: ChannelType,
	): Promise<Result<Session, SessionRepositoryError>> {
		throw new Error("not used in these tests");
	}

	async appendTurn(
		_session: Session,
		_turn: Omit<ConversationTurn, "timestamp">,
	): Promise<Result<Session, SessionRepositoryError>> {
		throw new Error("not used in these tests");
	}

	async updateMetadata(
		session: Session,
		metadata: Record<string, unknown>,
	): Promise<Result<Session, SessionRepositoryError>> {
		this.updateMetadataCalls.push({ session, metadata });
		if (this.updateMetadataResult) return this.updateMetadataResult;
		return ok({ ...session, metadata });
	}
}

function makeSession(overrides: Partial<Session> = {}): Session {
	const now = new Date("2026-05-27T00:00:00.000Z");
	return {
		id: "sess-1",
		channel: "telegram",
		userId: "u-1",
		history: [],
		metadata: {},
		createdAt: now,
		updatedAt: now,
		expiresAt: new Date(now.getTime() + 86_400_000),
		...overrides,
	};
}

interface Harness {
	useCase: HandleHabeasDataConsentUseCase;
	sessions: FakeSessionRepository;
}

function buildHarness(): Harness {
	const sessions = new FakeSessionRepository();
	const useCase = new HandleHabeasDataConsentUseCase({ sessions });
	return { useCase, sessions };
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

describe("HandleHabeasDataConsentUseCase — new session (NEEDS_CONSENT)", () => {
	let h: Harness;
	beforeEach(() => {
		h = buildHarness();
	});

	it("returns the consent text for a brand new session", async () => {
		const session = makeSession();
		const result = await h.useCase.execute(session, "hola");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.handled).toBe(true);
		if (!result.value.handled) return;
		expect(result.value.response).toContain("Ley 1581 de 2012");
		expect(result.value.response).toContain("Sí");
		expect(result.value.response).toContain("No");
	});

	it("sets awaitingHabeasConsent=true in metadata", async () => {
		const session = makeSession();
		await h.useCase.execute(session, "hola");

		expect(h.sessions.updateMetadataCalls).toHaveLength(1);
		const call = h.sessions.updateMetadataCalls[0]!;
		expect(call.metadata).toEqual({ awaitingHabeasConsent: true });
	});

	it("returns the updated session so the caller does not re-read stale state", async () => {
		const session = makeSession();
		const result = await h.useCase.execute(session, "hola");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.session.metadata.awaitingHabeasConsent).toBe(true);
	});
});

describe("HandleHabeasDataConsentUseCase — AWAITING_RESPONSE affirmatives", () => {
	const cases = [
		"si",
		"Sí",
		"SÍ",
		"sí",
		"acepto",
		"ok",
		"dale",
		"claro",
		"por supuesto",
		"de acuerdo",
		"yes",
		"listo",
	];

	for (const text of cases) {
		it(`accepts "${text}" as consent`, async () => {
			const h = buildHarness();
			const session = makeSession({
				metadata: { awaitingHabeasConsent: true },
			});

			const result = await h.useCase.execute(session, text);

			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.handled).toBe(true);
			if (!result.value.handled) return;
			expect(result.value.response).toContain("Gracias");

			expect(h.sessions.updateMetadataCalls).toHaveLength(1);
			const call = h.sessions.updateMetadataCalls[0]!;
			expect(call.metadata.habeasDataConsent).toBe(true);
			expect(call.metadata.awaitingHabeasConsent).toBe(false);
			expect(typeof call.metadata.habeasConsentDate).toBe("string");
			expect(call.metadata.habeasConsentDate as string).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});
	}

	it("returns the updated session reflecting the accepted state", async () => {
		const h = buildHarness();
		const session = makeSession({
			metadata: { awaitingHabeasConsent: true },
		});

		const result = await h.useCase.execute(session, "si");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.session.metadata.habeasDataConsent).toBe(true);
		expect(result.value.session.metadata.awaitingHabeasConsent).toBe(false);
	});
});

describe("HandleHabeasDataConsentUseCase — AWAITING_RESPONSE negatives", () => {
	const cases = ["no", "No", "NO", "nop", "nel", "negativo", "rechazo", "nah"];

	for (const text of cases) {
		it(`rejects "${text}" as denial`, async () => {
			const h = buildHarness();
			const session = makeSession({
				metadata: { awaitingHabeasConsent: true },
			});

			const result = await h.useCase.execute(session, text);

			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.handled).toBe(true);
			if (!result.value.handled) return;
			expect(result.value.response).toContain("Entendido");

			expect(h.sessions.updateMetadataCalls).toHaveLength(1);
			const call = h.sessions.updateMetadataCalls[0]!;
			expect(call.metadata.habeasDataConsent).toBe(false);
			expect(call.metadata.awaitingHabeasConsent).toBe(false);
			expect(call.metadata.habeasConsentDate).toBeUndefined();
		});
	}
});

describe("HandleHabeasDataConsentUseCase — AWAITING_RESPONSE ambiguous", () => {
	const cases = ["tal vez", "hmm", "qué es eso", "123"];

	for (const text of cases) {
		it(`re-prompts for "${text}" without touching metadata`, async () => {
			const h = buildHarness();
			const session = makeSession({
				metadata: { awaitingHabeasConsent: true },
			});

			const result = await h.useCase.execute(session, text);

			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.handled).toBe(true);
			if (!result.value.handled) return;
			expect(result.value.response).toContain("Sí");
			expect(result.value.response).toContain("No");
			expect(h.sessions.updateMetadataCalls).toHaveLength(0);
			// Session passes through unchanged.
			expect(result.value.session).toBe(session);
		});
	}
});

describe("HandleHabeasDataConsentUseCase — RESOLVED", () => {
	it("returns handled=false when habeasDataConsent=true", async () => {
		const h = buildHarness();
		const session = makeSession({ metadata: { habeasDataConsent: true } });

		const result = await h.useCase.execute(session, "hola");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.handled).toBe(false);
		expect(h.sessions.updateMetadataCalls).toHaveLength(0);
		expect(result.value.session).toBe(session);
	});

	it("returns handled=false when habeasDataConsent=false", async () => {
		const h = buildHarness();
		const session = makeSession({ metadata: { habeasDataConsent: false } });

		const result = await h.useCase.execute(session, "hola");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.handled).toBe(false);
		expect(h.sessions.updateMetadataCalls).toHaveLength(0);
	});
});

describe("HandleHabeasDataConsentUseCase — legacy session without consent state", () => {
	it("prompts retroactively when history > 0 and no consent metadata (legacy users)", async () => {
		const h = buildHarness();
		const session = makeSession({
			history: [
				{
					role: "user",
					content: "hola",
					timestamp: new Date("2026-05-27T00:00:00.000Z"),
				},
				{
					role: "assistant",
					content: "respuesta previa",
					timestamp: new Date("2026-05-27T00:00:01.000Z"),
				},
			],
			metadata: {},
		});

		const result = await h.useCase.execute(session, "otra pregunta");

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.handled).toBe(true);
		if (!result.value.handled) return;
		expect(result.value.response).toContain("Ley 1581 de 2012");

		expect(h.sessions.updateMetadataCalls).toHaveLength(1);
		const call = h.sessions.updateMetadataCalls[0]!;
		expect(call.metadata).toEqual({ awaitingHabeasConsent: true });
	});
});

describe("HandleHabeasDataConsentUseCase — error propagation", () => {
	it("propagates SessionRepositoryError from updateMetadata (new session path)", async () => {
		const h = buildHarness();
		h.sessions.updateMetadataResult = err(new SessionRepositoryError("updateMetadata"));
		const session = makeSession();

		const result = await h.useCase.execute(session, "hola");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toBeInstanceOf(SessionRepositoryError);
	});

	it("propagates SessionRepositoryError on affirmative update failure", async () => {
		const h = buildHarness();
		h.sessions.updateMetadataResult = err(new SessionRepositoryError("updateMetadata"));
		const session = makeSession({
			metadata: { awaitingHabeasConsent: true },
		});

		const result = await h.useCase.execute(session, "si");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toBeInstanceOf(SessionRepositoryError);
	});

	it("propagates SessionRepositoryError on negative update failure", async () => {
		const h = buildHarness();
		h.sessions.updateMetadataResult = err(new SessionRepositoryError("updateMetadata"));
		const session = makeSession({
			metadata: { awaitingHabeasConsent: true },
		});

		const result = await h.useCase.execute(session, "no");

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toBeInstanceOf(SessionRepositoryError);
	});
});
