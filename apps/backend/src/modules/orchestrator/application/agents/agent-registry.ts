import type { Category } from "@/modules/orchestrator/domain/entities/classification";
import type { AgentPort } from "@/modules/orchestrator/domain/ports/agent.port";

/**
 * Resolves the specialized agent that should handle a classified category.
 *
 * `null` means "no agent applies" — the use case must handle the category
 * itself (e.g. `non_commercial` / `not_understood` static replies).
 */
export interface AgentRegistry {
	resolve(category: Category): AgentPort | null;
}

export interface MapAgentRegistryDeps {
	faq: AgentPort;
	quotation: AgentPort;
}

export class MapAgentRegistry implements AgentRegistry {
	constructor(private readonly agents: MapAgentRegistryDeps) {}

	resolve(category: Category): AgentPort | null {
		switch (category) {
			case "commercial_faq":
				return this.agents.faq;
			case "commercial_quotation":
				return this.agents.quotation;
			case "non_commercial":
			case "not_understood":
				return null;
		}
	}
}
