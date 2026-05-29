export const SESSION_TTL_SECONDS = 86_400;
export const MAX_HISTORY_TURNS = 10;

/**
 * Maximum iterations of the agentic loop in `ProcessTelegramMessageUseCase`.
 * Hard cap to avoid runaway loops if the LLM keeps requesting tools forever.
 */
export const MAX_AGENT_ITERATIONS = 5;

/**
 * Tools the customer-service agent is allowed to call.
 *
 * The MCP server may expose more tools than this; the allowlist is the
 * contract this use-case enforces. Adding a tool here requires the LLM prompt
 * to know how to use it.
 */
export const ALLOWED_AGENT_TOOLS = [
	"search_faq",
	"process_quote",
	"get_store_info",
] as const;

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
	"Disculpe, no entendí bien su mensaje. ¿Podría reformularlo con más detalle?",
	"Aún no logro entenderle. ¿Me puede dar más detalles sobre lo que necesita?",
];

export const HUMAN_ADVISOR_REPLY =
	`Disculpe, no logro entender su consulta. Por favor contacte a un asesor humano de Sidoc al ${SIDOC_HUMAN_ADVISOR_PHONE}.`;

export const NON_COMMERCIAL_REPLY =
	"Su consulta no es comercial. Para que pueda ser atendido por el área correspondiente, " +
	`por favor contacte a Sidoc al ${SIDOC_HUMAN_ADVISOR_PHONE} y solicite ser transferido ` +
	"al área pertinente (reclamos, proveedores, contabilidad, gestión humana o chatarra).";
