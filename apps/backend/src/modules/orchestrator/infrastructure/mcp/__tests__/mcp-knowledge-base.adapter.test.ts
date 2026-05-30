import { beforeEach, describe, expect, it } from "bun:test";

import { KnowledgeBaseUnavailableError } from "@/modules/orchestrator/domain/errors";
import { McpKnowledgeBaseAdapter } from "../mcp-knowledge-base.adapter";
import { McpTimeoutError, type McpClient } from "../mcp-client.port";

class FakeMcpClient implements McpClient {
	readResourceCalls: string[] = [];
	getPromptCalls: Array<{ name: string; args: Record<string, string> }> = [];
	callToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

	readResourceImpl: (uri: string) => Promise<string> = async () =>
		"default-catalog";
	getPromptImpl: (
		name: string,
		args: Record<string, string>,
	) => Promise<string> = async () => "default-prompt";
	callToolImpl: (
		name: string,
		args: Record<string, unknown>,
	) => Promise<string> = async () => "default-tool";

	now = () => Date.now();

	async readResource(uri: string): Promise<string> {
		this.readResourceCalls.push(uri);
		return this.readResourceImpl(uri);
	}

	async getPrompt(name: string, args: Record<string, string>): Promise<string> {
		this.getPromptCalls.push({ name, args });
		return this.getPromptImpl(name, args);
	}

	async callTool(name: string, args: Record<string, unknown>): Promise<string> {
		this.callToolCalls.push({ name, args });
		return this.callToolImpl(name, args);
	}
}

describe("McpKnowledgeBaseAdapter", () => {
	let mcp: FakeMcpClient;
	let kb: McpKnowledgeBaseAdapter;

	beforeEach(() => {
		mcp = new FakeMcpClient();
		kb = new McpKnowledgeBaseAdapter(mcp, { now: () => mcp.now() });
	});

	describe("getFaqCatalog", () => {
		it("reads the faq://catalog resource the first time", async () => {
			mcp.readResourceImpl = async () => "FAQ CATALOG TEXT";

			const result = await kb.getFaqCatalog();

			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe("FAQ CATALOG TEXT");
			expect(mcp.readResourceCalls).toEqual(["faq://catalog"]);
		});

		it("caches the catalog for 5 minutes (no second MCP read)", async () => {
			mcp.readResourceImpl = async () => "CACHED CATALOG";

			await kb.getFaqCatalog();
			await kb.getFaqCatalog();
			await kb.getFaqCatalog();

			expect(mcp.readResourceCalls).toHaveLength(1);
		});

		it("re-reads after the 5-minute cache expires", async () => {
			mcp.readResourceImpl = async () => "CATALOG-v1";

			await kb.getFaqCatalog();
			mcp.now = () => Date.now() + 5 * 60 * 1000 + 1;
			await kb.getFaqCatalog();

			expect(mcp.readResourceCalls).toHaveLength(2);
		});

		it("wraps MCP failures in KnowledgeBaseUnavailableError (Err)", async () => {
			mcp.readResourceImpl = async () => {
				throw new McpTimeoutError(10000);
			};

			const result = await kb.getFaqCatalog();

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(KnowledgeBaseUnavailableError);
				expect(result.error.cause).toBeInstanceOf(McpTimeoutError);
			}
		});

		it("does not cache errors — a successful retry repopulates the cache", async () => {
			let attempt = 0;
			mcp.readResourceImpl = async () => {
				attempt++;
				if (attempt === 1) throw new McpTimeoutError(10000);
				return "FINALLY";
			};

			const first = await kb.getFaqCatalog();
			const second = await kb.getFaqCatalog();

			expect(first.ok).toBe(false);
			expect(second.ok).toBe(true);
			if (second.ok) expect(second.value).toBe("FINALLY");
		});
	});

	describe("getSystemPrompt", () => {
		it("forwards the context and maps habeasDataConsent=true to 'true'", async () => {
			mcp.getPromptImpl = async () => "PROMPT";

			const result = await kb.getSystemPrompt({
				context: "FAQ DATA",
				habeasDataConsent: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe("PROMPT");
			expect(mcp.getPromptCalls).toEqual([
				{
					name: "customer_service",
					args: { context: "FAQ DATA", habeas_data_consent: "true" },
				},
			]);
		});

		it("maps habeasDataConsent=false to 'false'", async () => {
			await kb.getSystemPrompt({ context: "ctx", habeasDataConsent: false });

			expect(mcp.getPromptCalls[0]!.args).toEqual({
				context: "ctx",
				habeas_data_consent: "false",
			});
		});

		it("omits habeas_data_consent when consent is undefined", async () => {
			await kb.getSystemPrompt({ context: "ctx" });

			expect(mcp.getPromptCalls[0]!.args).toEqual({ context: "ctx" });
		});

		it("wraps MCP failures in KnowledgeBaseUnavailableError (Err)", async () => {
			mcp.getPromptImpl = async () => {
				throw new McpTimeoutError(10000);
			};

			const result = await kb.getSystemPrompt({ context: "ctx" });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(KnowledgeBaseUnavailableError);
				expect(result.error.cause).toBeInstanceOf(McpTimeoutError);
			}
		});
	});

	describe("getAgentSystemPrompt", () => {
		it("maps 'faq' to the faq_agent MCP prompt", async () => {
			mcp.getPromptImpl = async () => "FAQ_PROMPT";

			const result = await kb.getAgentSystemPrompt("faq", {
				context: "FAQ DATA",
			});

			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe("FAQ_PROMPT");
			expect(mcp.getPromptCalls).toEqual([
				{ name: "faq_agent", args: { context: "FAQ DATA" } },
			]);
		});

		it("maps 'quotation' to the quotation_agent MCP prompt", async () => {
			mcp.getPromptImpl = async () => "QUOTE_PROMPT";

			const result = await kb.getAgentSystemPrompt("quotation", {
				context: "FAQ DATA",
				habeasDataConsent: true,
			});

			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe("QUOTE_PROMPT");
			expect(mcp.getPromptCalls).toEqual([
				{
					name: "quotation_agent",
					args: { context: "FAQ DATA", habeas_data_consent: "true" },
				},
			]);
		});

		it("maps habeasDataConsent=false to 'false'", async () => {
			await kb.getAgentSystemPrompt("quotation", {
				context: "ctx",
				habeasDataConsent: false,
			});

			expect(mcp.getPromptCalls[0]!.args).toEqual({
				context: "ctx",
				habeas_data_consent: "false",
			});
		});

		it("omits habeas_data_consent when consent is undefined", async () => {
			await kb.getAgentSystemPrompt("faq", { context: "ctx" });

			expect(mcp.getPromptCalls[0]!.args).toEqual({ context: "ctx" });
		});

		it("wraps MCP failures in KnowledgeBaseUnavailableError carrying the agent name", async () => {
			mcp.getPromptImpl = async () => {
				throw new McpTimeoutError(10000);
			};

			const result = await kb.getAgentSystemPrompt("faq", { context: "ctx" });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(KnowledgeBaseUnavailableError);
				expect(result.error.cause).toBeInstanceOf(McpTimeoutError);
				expect(result.error.message).toContain("faq");
			}
		});

		it("does not cache prompts (each call hits the MCP)", async () => {
			mcp.getPromptImpl = async () => "PROMPT";

			await kb.getAgentSystemPrompt("faq", { context: "ctx" });
			await kb.getAgentSystemPrompt("faq", { context: "ctx" });

			expect(mcp.getPromptCalls).toHaveLength(2);
		});
	});
});
