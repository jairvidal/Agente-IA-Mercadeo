import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { OutgoingReply } from "@/modules/orchestrator/domain/entities/outgoing-reply";
import type { Session } from "@/modules/orchestrator/domain/entities/session";
import type { MessageChannelPort } from "@/modules/orchestrator/domain/ports/message-channel.port";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";

export class ProcessTelegramMessageUseCase {
  constructor(
    private readonly channel: MessageChannelPort,
    private readonly sessions: SessionRepositoryPort,
  ) {}

  async execute(message: IncomingMessage): Promise<void> {
    const session = await this.sessions.getOrCreate(
      message.userId,
      message.channel,
    );

    const withUser = await this.sessions.appendTurn(session, {
      role: "user",
      content: message.text,
    });

    const replyText = this.draftReply(withUser);

    await this.sessions.appendTurn(withUser, {
      role: "assistant",
      content: replyText,
    });

    const reply: OutgoingReply = {
      sessionId: session.id,
      text: replyText,
      metadata: { chatId: message.metadata.chatId },
    };

    await this.channel.send(reply);
  }

  private draftReply(session: Session): string {
    const last = session.history[session.history.length - 1];
    return `Recibí: ${last?.content ?? ""} (turnos: ${session.history.length})`;
  }
}
