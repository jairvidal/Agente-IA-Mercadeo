import { beforeEach, describe, expect, it } from "bun:test";

import { ToolInvocationError } from "@/modules/orchestrator/domain/errors";
import { McpAgentToolAdapter } from "../mcp-agent-tool.adapter";
import { McpTimeoutError, type McpClient } from "../mcp-client.port";

class FakeMcpClient implements McpClient {
	callToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
	callToolImpl: (
		name: string,
		args: Record<string, unknown>,
	) => Promise<string> = async () => "default";

	async readResource(): Promise<string> {
		throw new Error("not used in this test");
	}
	async getPrompt(): Promise<string> {
		throw new Error("not used in this test");
	}
	async callTool(name: string, args: Record<string, unknown>): Promise<string> {
		this.callToolCalls.push({ name, args });
		return this.callToolImpl(name, args);
	}
}

describe("McpAgentToolAdapter", () => {
	let mcp: FakeMcpClient;
	let tools: McpAgentToolAdapter;

	beforeEach(() => {
		mcp = new FakeMcpClient();
		tools = new McpAgentToolAdapter(mcp);
	});

	it("forwards name and args to the MCP client and returns Ok with the text", async () => {
		mcp.callToolImpl = async () => "TOOL RESULT";

		const result = await tools.invoke("search_faq", { query: "horario Cali" });

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe("TOOL RESULT");
		expect(mcp.callToolCalls).toEqual([
			{ name: "search_faq", args: { query: "horario Cali" } },
		]);
	});

	it("wraps MCP timeouts in ToolInvocationError with the tool name", async () => {
		mcp.callToolImpl = async () => {
			throw new McpTimeoutError(10000);
		};

		const result = await tools.invoke("process_quote", { product: "x" });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeInstanceOf(ToolInvocationError);
			expect(result.error.message).toContain("process_quote");
			expect(result.error.cause).toBeInstanceOf(McpTimeoutError);
		}
	});

	it("wraps generic transport errors in ToolInvocationError", async () => {
		mcp.callToolImpl = async () => {
			throw new Error("connection refused");
		};

		const result = await tools.invoke("search_faq", {});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBeInstanceOf(ToolInvocationError);
	});
});
