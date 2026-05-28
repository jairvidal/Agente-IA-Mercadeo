export interface McpClient {
	callTool(name: string, args: Record<string, unknown>): Promise<string>;
	readResource(uri: string): Promise<string>;
	getPrompt(name: string, args: Record<string, string>): Promise<string>;
}

export class McpTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`MCP call exceeded ${timeoutMs}ms`);
		this.name = "McpTimeoutError";
	}
}
