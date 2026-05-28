import { logger } from "@sidoc/observability";
import { Elysia } from "elysia";

import type { ProcessTelegramMessageUseCase } from "@/modules/orchestrator/application/use-cases/process-telegram-message.use-case";
import { InvalidMessageError } from "@/modules/orchestrator/domain/errors";

import type { TelegramChannelAdapter } from "../channels/telegram.adapter";

interface TelegramRoutesDeps {
	adapter: TelegramChannelAdapter;
	useCase: ProcessTelegramMessageUseCase;
	webhookSecret: string;
}

export function buildTelegramRoutes({
	adapter,
	useCase,
	webhookSecret,
}: TelegramRoutesDeps) {
	return new Elysia({ prefix: "/orchestrator/telegram" }).post(
		"/webhook",
		async ({ body, headers, set }) => {
			const provided = headers["x-telegram-bot-api-secret-token"] ?? "";
			if (provided !== webhookSecret) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			// parseIncoming still throws (validation at the transport boundary —
			// an invalid payload from Telegram is a 400, not a domain error).
			let message;
			try {
				message = adapter.parseIncoming(body);
			} catch (err) {
				if (err instanceof InvalidMessageError) {
					set.status = 400;
					return { error: err.message };
				}
				throw err;
			}

			// Result boundary: this is the ONLY place in the application layer
			// where we open the Result. Any domain error here is logged and we
			// still ack 200 to Telegram — otherwise Telegram retries the same
			// update forever, amplifying the outage.
			const result = await useCase.execute(message);

			if (!result.ok) {
				logger.error(
					{
						name: result.error.name,
						err: result.error,
						cause: result.error.cause,
					},
					"telegram-webhook use-case error",
				);
			}

			return { status: "ok" };
		},
	);
}
