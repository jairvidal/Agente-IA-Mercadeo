import type { Session } from "@/modules/orchestrator/domain/entities/session";
import type { SessionRepositoryError } from "@/modules/orchestrator/domain/errors";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";
import { ok, type Result } from "@/modules/orchestrator/domain/result";
import { normalizeText } from "@/modules/orchestrator/domain/text";

/**
 * Outcome of the Habeas Data consent gate.
 *
 * - `intercepted: true`  → the gate caught this turn and produced the
 *   user-facing response (consent prompt, re-prompt, acceptance/denial ack).
 *   The caller must short-circuit and send `response` to the channel.
 * - `intercepted: false` → the message passes through: consent is already
 *   resolved (or the session is past the "first message" window with no consent
 *   state, an edge case preserved for parity with the legacy handler). The
 *   caller continues the normal flow.
 *
 * `session` is the (potentially updated) Session that the caller should keep
 * working with — every successful `updateMetadata` returns a new Session and
 * we propagate that here so downstream code never operates on a stale copy.
 */
export type ConsentResult =
  | { intercepted: true; response: string; session: Session }
  | { intercepted: false; session: Session };

const DEFAULT_CONSENT_TEXT =
  "¡Hola! Soy *Sidoco*, el asistente virtual de *Sidoc S.A.* 🏗️\n\n" +
  "Antes de continuar, de acuerdo con la *Ley 1581 de 2012* y su Decreto Reglamentario 1377 de 2013, " +
  "te informamos que tus datos personales serán tratados conforme a nuestra Política de Tratamiento " +
  "de Datos Personales, con la finalidad de atender tus consultas y gestionar cotizaciones.\n\n" +
  "Puedes consultar nuestra política completa en https://sidocsa.com\n\n" +
  "¿Aceptas el tratamiento de tus datos personales?\n" +
  "Responde *Sí* o *No*.";

const ACCEPTED_REPLY =
  "¡Gracias por aceptar! Ahora puedo ayudarte con cotizaciones, información de productos, " +
  "tiendas, horarios, servicios y más. ¿En qué puedo ayudarte?";

const DENIED_REPLY =
  "Entendido. Puedes consultar información general sobre nuestros productos, servicios y tiendas. " +
  "¿En qué puedo ayudarte?";

const AMBIGUOUS_REPLY =
  "No logré entender tu respuesta. Por favor responde *Sí* o *No* para continuar.";

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
 *   1. Resolved (`habeasDataConsent` present) → `intercepted=false` (pass through).
 *   2. Awaiting + affirmative → mark accepted, return ack.
 *   3. Awaiting + negative   → mark denied, return ack.
 *   4. Awaiting + ambiguous  → re-prompt, do NOT touch metadata.
 *   5. Otherwise (no consent state yet, regardless of history) → show consent
 *      text and mark `awaitingHabeasConsent=true`. This covers both brand-new
 *      sessions AND legacy sessions that pre-date this gate, so existing users
 *      are forced through the consent flow on their next message.
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
      return ok({ intercepted: false, session });
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
          intercepted: true,
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
          intercepted: true,
          response: DENIED_REPLY,
          session: updated.value,
        });
      }

      return ok({ intercepted: true, response: AMBIGUOUS_REPLY, session });
    }

    const updated = await this.sessions.updateMetadata(session, {
      ...session.metadata,
      awaitingHabeasConsent: true,
    });
    if (!updated.ok) return updated;
    return ok({
      intercepted: true,
      response: DEFAULT_CONSENT_TEXT,
      session: updated.value,
    });
  }
}
