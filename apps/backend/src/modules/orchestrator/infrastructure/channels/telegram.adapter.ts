import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { OutgoingReply } from "@/modules/orchestrator/domain/entities/outgoing-reply";
import {
  InvalidMessageError,
  MessageChannelError,
} from "@/modules/orchestrator/domain/errors";
import type { MessageChannelPort } from "@/modules/orchestrator/domain/ports/message-channel.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number };
    chat: { id: number };
    text?: string;
    date: number;
  };
}

export interface TelegramChannelAdapterDeps {
  fetchImpl?: typeof fetch;
}

export class TelegramChannelAdapter implements MessageChannelPort {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly botToken: string,
    deps: TelegramChannelAdapterDeps = {},
  ) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
  }

  parseIncoming(raw: unknown): IncomingMessage {
    const update = raw as TelegramUpdate;
    const msg = update?.message;

    if (!msg || typeof msg.text !== "string") {
      throw new InvalidMessageError("missing message.text");
    }

    return {
      id: String(msg.message_id),
      channel: "telegram",
      userId: String(msg.from.id),
      sessionId: `tg-${msg.from.id}`,
      text: msg.text,
      receivedAt: new Date(msg.date * 1000),
      metadata: { chatId: msg.chat.id },
    };
  }

  async send(reply: OutgoingReply): Promise<Result<void, MessageChannelError>> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: reply.metadata.chatId,
          text: reply.text,
          parse_mode: "Markdown",
        }),
      });
    } catch (cause) {
      // Network failure / timeout / DNS — fetch itself threw.
      return err(new MessageChannelError("send", cause));
    }

    if (!res.ok) {
      return err(
        new MessageChannelError(
          "send",
          new Error(`Telegram API error: ${res.status}`),
        ),
      );
    }

    return ok(undefined);
  }
}
