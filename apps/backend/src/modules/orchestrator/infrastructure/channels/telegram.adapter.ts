import { InvalidMessageError } from "@/modules/orchestrator/domain/errors";
import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { OutgoingReply } from "@/modules/orchestrator/domain/entities/outgoing-reply";
import type { MessageChannelPort } from "@/modules/orchestrator/domain/ports/message-channel.port";

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

export class TelegramChannelAdapter implements MessageChannelPort {
  constructor(private readonly botToken: string) {}

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

  async send(reply: OutgoingReply): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: reply.metadata.chatId,
        text: reply.text,
        parse_mode: "Markdown",
      }),
    });

    if (!res.ok) {
      throw new Error(`Telegram API error: ${res.status}`);
    }
  }
}
