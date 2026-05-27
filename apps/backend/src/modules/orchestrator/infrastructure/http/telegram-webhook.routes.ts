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

      try {
        const message = adapter.parseIncoming(body);
        await useCase.execute(message);
        return { status: "ok" };
      } catch (err) {
        if (err instanceof InvalidMessageError) {
          set.status = 400;
          return { error: err.message };
        }
        throw err;
      }
    },
  );
}
