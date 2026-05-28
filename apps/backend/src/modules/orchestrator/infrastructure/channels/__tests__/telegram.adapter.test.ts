import { describe, expect, it } from "bun:test";

import {
	InvalidMessageError,
	MessageChannelError,
} from "@/modules/orchestrator/domain/errors";
import { TelegramChannelAdapter } from "../telegram.adapter";

interface FakeFetchCall {
	url: string;
	init: RequestInit | undefined;
}

function buildAdapter(
	fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
): {
	adapter: TelegramChannelAdapter;
	calls: FakeFetchCall[];
} {
	const calls: FakeFetchCall[] = [];
	const wrapped = (async (input: unknown, init?: RequestInit) => {
		calls.push({ url: String(input), init });
		return fetchImpl(String(input), init);
	}) as unknown as typeof fetch;
	const adapter = new TelegramChannelAdapter("BOT-TOKEN", {
		fetchImpl: wrapped,
	});
	return { adapter, calls };
}

describe("TelegramChannelAdapter", () => {
	describe("parseIncoming", () => {
		it("throws InvalidMessageError when message.text is missing", () => {
			const adapter = new TelegramChannelAdapter("BOT-TOKEN");
			expect(() => adapter.parseIncoming({ update_id: 1 })).toThrow(
				InvalidMessageError,
			);
		});
	});

	describe("send", () => {
		it("returns Ok and POSTs to the Telegram sendMessage endpoint on 200", async () => {
			const { adapter, calls } = buildAdapter(async () => {
				return new Response("{}", { status: 200 });
			});

			const result = await adapter.send({
				sessionId: "s-1",
				text: "hola",
				metadata: { chatId: 42 },
			});

			expect(result.ok).toBe(true);
			expect(calls).toHaveLength(1);
			expect(calls[0]!.url).toBe(
				"https://api.telegram.org/botBOT-TOKEN/sendMessage",
			);
			expect(calls[0]!.init?.method).toBe("POST");
			const body = JSON.parse(String(calls[0]!.init?.body));
			expect(body).toEqual({
				chat_id: 42,
				text: "hola",
				parse_mode: "Markdown",
			});
		});

		it("returns Err(MessageChannelError) on 5xx from Telegram", async () => {
			const { adapter } = buildAdapter(async () => {
				return new Response("upstream down", { status: 502 });
			});

			const result = await adapter.send({
				sessionId: "s-1",
				text: "hola",
				metadata: { chatId: 42 },
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(MessageChannelError);
				expect(result.error.message).toContain("send");
				const cause = result.error.cause as Error;
				expect(cause).toBeInstanceOf(Error);
				expect(cause.message).toContain("502");
			}
		});

		it("returns Err(MessageChannelError) when fetch itself throws (network/timeout)", async () => {
			const { adapter } = buildAdapter(async () => {
				throw new TypeError("network error");
			});

			const result = await adapter.send({
				sessionId: "s-1",
				text: "hola",
				metadata: { chatId: 42 },
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(MessageChannelError);
				expect(result.error.cause).toBeInstanceOf(TypeError);
			}
		});
	});
});
