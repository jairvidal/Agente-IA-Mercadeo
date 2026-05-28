import type { ChannelType } from "@/modules/orchestrator/domain/entities/channel";
import type {
	ConversationTurn,
	Session,
} from "@/modules/orchestrator/domain/entities/session";
import type { SessionRepositoryError } from "@/modules/orchestrator/domain/errors";
import type { Result } from "@/modules/orchestrator/domain/result";

export interface SessionRepositoryPort {
	getOrCreate(
		userId: string,
		channel: ChannelType,
	): Promise<Result<Session, SessionRepositoryError>>;
	appendTurn(
		session: Session,
		turn: Omit<ConversationTurn, "timestamp">,
	): Promise<Result<Session, SessionRepositoryError>>;
	updateMetadata(
		session: Session,
		metadata: Record<string, unknown>,
	): Promise<Result<Session, SessionRepositoryError>>;
}
