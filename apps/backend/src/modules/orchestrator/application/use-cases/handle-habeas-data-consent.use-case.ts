import type { Session } from "@/modules/orchestrator/domain/entities/session";
import { SessionRepositoryError } from "@/modules/orchestrator/domain/errors";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";
import { ok, type Result } from "@/modules/orchestrator/domain/result";

/**
 * Outcome of the Habeas Data consent gate.
 *
 * - `handled: true`  → the use-case has produced the user-facing response for
 *   this turn (consent prompt, re-prompt, acceptance/denial ack). The caller
 *   must short-circuit and send `response` to the channel.
 * - `handled: false` → consent is already resolved (or the session is past the
 *   "first message" window with no consent state, an edge case preserved for
 *   parity with the legacy handler). The caller continues the normal flow.
 *
 * `session` is the (potentially updated) Session that the caller should keep
 * working with — every successful `updateMetadata` returns a new Session and
 * we propagate that here so downstream code never operates on a stale copy.
 */
export type ConsentResult =
	| { handled: true; response: string; session: Session }
	| { handled: false; session: Session };

const DEFAULT_CONSENT_TEXT =
	"Bienvenido/a a *Sidoc S.A.* 🏗️\n\n" +
	"Antes de continuar, de acuerdo con la *Ley 1581 de 2012* y su Decreto Reglamentario 1377 de 2013, " +
	"le informamos que sus datos personales serán tratados conforme a nuestra Política de Tratamiento " +
	"de Datos Personales, con la finalidad de atender sus consultas y gestionar cotizaciones.\n\n" +
	"Puede consultar nuestra política completa en https://sidocsa.com\n\n" +
	"¿Acepta el tratamiento de sus datos personales?\n" +
	"Responda *Sí* o *No*.";

const ACCEPTED_REPLY =
	"Gracias por aceptar. Ahora puedo ayudarle con cotizaciones y consultas sobre nuestros productos. " +
	"¿En qué puedo servirle?";

const DENIED_REPLY =
	"Entendido. Puede consultar información general sobre nuestros productos, servicios y tiendas. " +
	"¿En qué puedo ayudarle?";

const AMBIGUOUS_REPLY =
	"No logré entender su respuesta. Por favor responda *Sí* o *No* para continuar.";

const AFFIRMATIVE_PATTERNS = [
	"si",
	"yes",
	"acepto",
	"ok",
	"dale",
	"claro",
	"por supuesto",
	"de acuerdo",
	"afirmativo",
	"listo",
];

const NEGATIVE_PATTERNS = ["no", "nop", "nel", "negativo", "no acepto", "rechazo", "nah"];

const normalizeText = (text: string): string =>
	text
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();

const isAffirmative = (text: string): boolean => {
	const normalized = normalizeText(text);
	return AFFIRMATIVE_PATTERNS.some((p) => normalized === p || normalized.startsWith(`${p} `));
};

const isNegative = (text: string): boolean => {
	const normalized = normalizeText(text);
	return NEGATIVE_PATTERNS.some((p) => normalized === p || normalized.startsWith(`${p} `));
};

export interface HandleHabeasDataConsentDeps {
	sessions: SessionRepositoryPort;
}

/**
 * Habeas Data (Ley 1581 de 2012) consent gate.
 *
 * State lives in `session.metadata`:
 *   - `habeasDataConsent: boolean`   → resolved (true=accepted, false=denied).
 *   - `awaitingHabeasConsent: true`  → consent prompt was shown, expecting Sí/No.
 *   - `habeasConsentDate: string`    → ISO timestamp of acceptance.
 *
 * The state machine:
 *   1. Resolved (`habeasDataConsent` present) → `handled=false` (pass through).
 *   2. Awaiting + affirmative → mark accepted, return ack.
 *   3. Awaiting + negative   → mark denied, return ack.
 *   4. Awaiting + ambiguous  → re-prompt, do NOT touch metadata.
 *   5. First message ever (`history.length === 0`) → show consent text,
 *      mark `awaitingHabeasConsent=true`.
 *   6. Otherwise (history but no consent state — should not normally happen,
 *      kept for parity with the legacy handler) → `handled=false`.
 */
export class HandleHabeasDataConsentUseCase {
	private readonly sessions: SessionRepositoryPort;

	constructor(deps: HandleHabeasDataConsentDeps) {
		this.sessions = deps.sessions;
	}

	async execute(
		session: Session,
		messageText: string,
	): Promise<Result<ConsentResult, SessionRepositoryError>> {
		const { habeasDataConsent, awaitingHabeasConsent } = session.metadata;

		if (typeof habeasDataConsent === "boolean") {
			return ok({ handled: false, session });
		}

		if (awaitingHabeasConsent === true) {
			if (isAffirmative(messageText)) {
				const updated = await this.sessions.updateMetadata(session, {
					...session.metadata,
					habeasDataConsent: true,
					awaitingHabeasConsent: false,
					habeasConsentDate: new Date().toISOString(),
				});
				if (!updated.ok) return updated;
				return ok({
					handled: true,
					response: ACCEPTED_REPLY,
					session: updated.value,
				});
			}

			if (isNegative(messageText)) {
				const updated = await this.sessions.updateMetadata(session, {
					...session.metadata,
					habeasDataConsent: false,
					awaitingHabeasConsent: false,
				});
				if (!updated.ok) return updated;
				return ok({
					handled: true,
					response: DENIED_REPLY,
					session: updated.value,
				});
			}

			return ok({ handled: true, response: AMBIGUOUS_REPLY, session });
		}

		if (session.history.length === 0) {
			const updated = await this.sessions.updateMetadata(session, {
				...session.metadata,
				awaitingHabeasConsent: true,
			});
			if (!updated.ok) return updated;
			return ok({
				handled: true,
				response: DEFAULT_CONSENT_TEXT,
				session: updated.value,
			});
		}

		return ok({ handled: false, session });
	}
}
