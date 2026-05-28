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
