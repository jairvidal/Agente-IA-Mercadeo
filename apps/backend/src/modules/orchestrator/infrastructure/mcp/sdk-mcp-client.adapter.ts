import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { McpTimeoutError, type McpClient } from "./mcp-client.port";

export interface SdkMcpClientConfig {
	url: string;
	token: string;
	timeoutMs: number;
}

export class SdkMcpClient implements McpClient {
	private client: Client | null = null;
	private connecting: Promise<Client> | null = null;

	constructor(private readonly config: SdkMcpClientConfig) {}

	async callTool(name: string, args: Record<string, unknown>): Promise<string> {
		const client = await this.getClient();
		const result = await this.withTimeout(
			client.callTool({ name, arguments: args }),
		);
		const content = (
			result.content as Array<{ type: string; text?: string }>
		)[0];
		return content?.text ?? "";
	}

	async readResource(uri: string): Promise<string> {
		const client = await this.getClient();
		const result = await this.withTimeout(client.readResource({ uri }));
		const content = result.contents[0];
		return content && "text" in content ? String(content.text) : "";
	}

	async getPrompt(name: string, args: Record<string, string>): Promise<string> {
		const client = await this.getClient();
		const result = await this.withTimeout(
			client.getPrompt({ name, arguments: args }),
		);
		const msg = result.messages[0];
		return msg && typeof msg.content === "object" && "text" in msg.content
			? String(msg.content.text)
			: "";
	}

	private async getClient(): Promise<Client> {
		if (this.client) return this.client;
		if (this.connecting) return this.connecting;

		this.connecting = (async () => {
			const client = new Client({
				name: "sidoc-orchestrator",
				version: "1.0.0",
			});
			const transport = new StreamableHTTPClientTransport(
				new URL(this.config.url),
				{
					requestInit: {
						headers: { "X-Internal-Token": this.config.token },
					},
				},
			);
			await client.connect(transport);
			this.client = client;
			return client;
		})();

		try {
			return await this.connecting;
		} finally {
			this.connecting = null;
		}
	}

	private withTimeout<T>(promise: Promise<T>): Promise<T> {
		const ms = this.config.timeoutMs;
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => reject(new McpTimeoutError(ms)), ms);
			promise.then(
				(value) => {
					clearTimeout(timer);
					resolve(value);
				},
				(err) => {
					clearTimeout(timer);
					reject(err);
				},
			);
		});
	}
}
