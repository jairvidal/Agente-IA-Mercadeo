import type { IncomingMessage } from "@/modules/orchestrator/domain/entities/incoming-message";
import type { OutgoingReply } from "@/modules/orchestrator/domain/entities/outgoing-reply";
import type { Session } from "@/modules/orchestrator/domain/entities/session";
import type {
	MessageChannelError,
	SessionRepositoryError,
} from "@/modules/orchestrator/domain/errors";
import type { MessageChannelPort } from "@/modules/orchestrator/domain/ports/message-channel.port";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";
import { ok, type Result } from "@/modules/orchestrator/domain/result";

export type ProcessTelegramMessageError =
	| SessionRepositoryError
	| MessageChannelError;

export class ProcessTelegramMessageUseCase {
	constructor(
		private readonly channel: MessageChannelPort,
		private readonly sessions: SessionRepositoryPort,
	) {}

	async execute(
		message: IncomingMessage,
	): Promise<Result<void, ProcessTelegramMessageError>> {
		const sessionResult = await this.sessions.getOrCreate(
			message.userId,
			message.channel,
		);
		if (!sessionResult.ok) return sessionResult;

		const withUserResult = await this.sessions.appendTurn(sessionResult.value, {
			role: "user",
			content: message.text,
		});
		if (!withUserResult.ok) return withUserResult;

		const replyText = this.draftReply(withUserResult.value);

		const withAssistantResult = await this.sessions.appendTurn(
			withUserResult.value,
			{ role: "assistant", content: replyText },
		);
		if (!withAssistantResult.ok) return withAssistantResult;

		const reply: OutgoingReply = {
			sessionId: sessionResult.value.id,
			text: replyText,
			metadata: { chatId: message.metadata.chatId },
		};

		const sendResult = await this.channel.send(reply);
		if (!sendResult.ok) return sendResult;

		return ok(undefined);
	}

	private draftReply(session: Session): string {
		const last = session.history[session.history.length - 1];
		return `Recibí: ${last?.content ?? ""} (turnos: ${session.history.length})`;
	}
}
