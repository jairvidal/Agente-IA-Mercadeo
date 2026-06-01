export const SESSION_TTL_SECONDS = 86_400;
export const MAX_HISTORY_TURNS = 10;

/**
 * Maximum iterations of the agentic loop in `ProcessTelegramMessageUseCase`.
 * Hard cap to avoid runaway loops if the LLM keeps requesting tools forever.
 */
export const MAX_AGENT_ITERATIONS = 5;

/**
 * Tools each specialized agent is allowed to call.
 *
 * The MCP server may expose more tools than these; each allowlist is the
 * contract its agent enforces. Adding a tool here requires the matching MCP
 * prompt (`faq_agent` / `quotation_agent`) to know how to use it.
 *
 * Note: `get_store_info` was previously listed but is NOT registered by the
 * MCP server. Removed until the MCP exposes it.
 */
export const FAQ_AGENT_TOOLS = ["search_faq"] as const;
export const QUOTATION_AGENT_TOOLS = ["process_quote"] as const;

/**
 * Union of tools any agent is allowed to call. Kept for backwards-compat
 * smoke checks / observability. Per-agent allowlists are the authoritative
 * boundary enforced at runtime.
 */
export const ALLOWED_AGENT_TOOLS = [
  ...new Set<string>([...FAQ_AGENT_TOOLS, ...QUOTATION_AGENT_TOOLS]),
] as readonly string[];

/** Fallback reply used when the agentic loop cannot resolve a response. */
export const AGENT_FALLBACK_REPLY =
  "Por el momento no puedo responder. Un asesor humano te contactará pronto.";

/**
 * Max number of clarification attempts before the bot offers a human advisor.
 * After this many consecutive `not_understood` classifications, the next one
 * triggers the human-advisor reply and the counter resets.
 */
export const MAX_CLARIFICATION_ATTEMPTS = 2;

/** Public phone of Sidoc S.A. shared with the user as the human-advisor fallback. */
export const SIDOC_HUMAN_ADVISOR_PHONE = "+57 (602) 664-4717";

export const CLARIFICATION_PROMPTS: readonly string[] = [
  "Disculpa, no entendí bien tu mensaje. ¿Podrías contarme un poco más para ayudarte mejor?",
  "Aún no logro entenderte. ¿Me das un poco más de detalle sobre lo que necesitas?",
];

/**
 * Reply shown after `MAX_CLARIFICATION_ATTEMPTS` consecutive `not_understood`
 * turns. Invites the user to type the advisor keyword (see `ADVISOR_KEYWORDS`)
 * instead of handing out a phone number, so the handoff stays inside the chat.
 */
export const HUMAN_ADVISOR_REPLY =
  "Lamento no haber podido procesar tu solicitud correctamente, pero no te preocupes, " +
  "estoy aquí para ayudarte. Si prefieres, puedo conectarte con un asesor; solo escribe *asesor*. " +
  "También puedes intentar nuevamente con otra consulta y con gusto te apoyo.";

export const NON_COMMERCIAL_REPLY =
  "Tu consulta no es comercial. Para que puedas ser atendido por el área correspondiente, " +
  `por favor contacta a Sidoc al ${SIDOC_HUMAN_ADVISOR_PHONE} y solicita ser transferido ` +
  "al área pertinente (reclamos, proveedores, contabilidad, gestión humana o chatarra).";

/**
 * Keywords that, when written by the user as a standalone word, trigger an
 * explicit handoff to a human advisor (`ADVISOR_TRANSFER_REPLY`). Matched on a
 * word boundary so "asesoría"/"asesoramiento" do NOT trigger it.
 */
export const ADVISOR_KEYWORDS: readonly string[] = ["asesor", "asesores"];

/** Reply sent when the user explicitly asks to talk to a human advisor. */
export const ADVISOR_TRANSFER_REPLY =
  "Para brindarte una atención más detallada, voy a transferir nuestra conversación a uno " +
  "de nuestros asesores, pronto te atenderemos, gracias por tu paciencia 🙂.";

/** IANA timezone used to evaluate Sidoc's business hours. Colombia is UTC-5 (no DST). */
export const BUSINESS_TIMEZONE = "America/Bogota";

/** Short weekday keys as produced by `Intl.DateTimeFormat(..., { weekday: "short" })` (en-US). */
export type Weekday = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

/** Open/close times for a single day, as "HH:MM" in `BUSINESS_TIMEZONE`. */
export interface DailyHours {
  open: string;
  close: string;
}

/**
 * Sidoc's service hours. `null` means closed all day.
 *
 * Mon-Fri 07:30-16:30 (admin + commercial), Sat 08:00-12:00 (commercial only),
 * Sun closed.
 *
 * TODO: Colombian public holidays ("festivos") are deferred for Sprint 1
 * (only Sundays are handled as closed). See PRD E-04.3.
 */
export const BUSINESS_HOURS: Record<Weekday, DailyHours | null> = {
  Sun: null,
  Mon: { open: "07:30", close: "16:30" },
  Tue: { open: "07:30", close: "16:30" },
  Wed: { open: "07:30", close: "16:30" },
  Thu: { open: "07:30", close: "16:30" },
  Fri: { open: "07:30", close: "16:30" },
  Sat: { open: "08:00", close: "12:00" },
};

/** Reply sent outside business hours (gate total). Verbatim copy from Sidoc. */
export const OFF_HOURS_REPLY =
  "Gracias por escribirnos. En este momento estamos fuera de nuestro horario de atención. " +
  "Atendemos de lunes a viernes de 7:30 a.m. a 4:30 p.m. en nuestras áreas administrativas y " +
  "comerciales, y los sábados de 8:00 a.m. a 12:00 p.m. únicamente en el área comercial " +
  "(tiendas Sidoc).\n\n" +
  "Domingos y festivos no contamos con atención.\n\n" +
  "Con gusto te atenderemos si nos escribes nuevamente dentro de este horario.";
