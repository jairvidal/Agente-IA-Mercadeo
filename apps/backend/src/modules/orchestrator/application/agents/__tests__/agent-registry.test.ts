import { describe, expect, it } from "bun:test";

import type { AgentReply } from "@/modules/orchestrator/domain/entities/agent-reply";
import type {
	AgentError,
	AgentPort,
	AgentRunContext,
} from "@/modules/orchestrator/domain/ports/agent.port";
import type { AgentName } from "@/modules/orchestrator/domain/ports/knowledge-base.port";
import { ok, type Result } from "@/modules/orchestrator/domain/result";

import { MapAgentRegistry } from "../agent-registry";

class FakeAgent implements AgentPort {
	constructor(readonly name: AgentName) {}

	async run(_ctx: AgentRunContext): Promise<Result<AgentReply, AgentError>> {
		return ok({ text: `reply from ${this.name}`, metadata: {} });
	}
}

describe("MapAgentRegistry", () => {
	const faq = new FakeAgent("faq");
	const quotation = new FakeAgent("quotation");
	const registry = new MapAgentRegistry({ faq, quotation });

	it("resolves commercial_faq -> FAQ agent", () => {
		expect(registry.resolve("commercial_faq")).toBe(faq);
	});

	it("resolves commercial_quotation -> Quotation agent", () => {
		expect(registry.resolve("commercial_quotation")).toBe(quotation);
	});

	it("returns null for non_commercial (handled by use case)", () => {
		expect(registry.resolve("non_commercial")).toBeNull();
	});

	it("returns null for not_understood (handled by use case)", () => {
		expect(registry.resolve("not_understood")).toBeNull();
	});
});
