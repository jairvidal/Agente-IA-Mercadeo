/**
 * Reply produced by a specialized agent (FAQ, Quotation).
 *
 * `text` is the user-facing response. `metadata` is freeform observability data
 * (e.g. `intent`, `iterations`, future per-agent fields). The use case merges
 * its own routing metadata (category, confidence) on top before persisting.
 */
export interface AgentReply {
	text: string;
	metadata: Record<string, unknown>;
}
