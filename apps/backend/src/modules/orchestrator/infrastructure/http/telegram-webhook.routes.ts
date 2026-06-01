import { logger } from "@sidoc/observability";
import { Elysia } from "elysia";

import type { ProcessTelegramMessageUseCase } from "@/modules/orchestrator/application/use-cases/process-telegram-message.use-case";
import { InvalidMessageError } from "@/modules/orchestrator/domain/errors";

import type { TelegramChannelAdapter } from "../channels/telegram.adapter";

interface TelegramRoutesDeps {
  adapter: TelegramChannelAdapter;
  processMessageUseCase: ProcessTelegramMessageUseCase;
  webhookSecret: string;
}

export function buildTelegramRoutes({
  adapter,
  processMessageUseCase,
  webhookSecret,
}: TelegramRoutesDeps) {
  return new Elysia({ prefix: "/orchestrator/telegram" }).post(
    "/webhook",
    async ({ body, headers, set }) => {
      const secret = headers["x-telegram-bot-api-secret-token"] ?? "";
      if (secret !== webhookSecret) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      let message;
      try {
        message = adapter.parseIncoming(body);
      } catch (err) {
        logger.error(
          { err, body },
          "Failed to parse incoming Telegram message",
        );
        if (err instanceof InvalidMessageError) {
          set.status = 400;
          return { error: err.message };
        }
        throw err;
      }

      const result = await processMessageUseCase.execute(message);

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
