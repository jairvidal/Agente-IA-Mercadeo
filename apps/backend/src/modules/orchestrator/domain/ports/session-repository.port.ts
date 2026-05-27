import type { ChannelType } from "../entities/channel";
import type { ConversationTurn, Session } from "../entities/session";

export interface SessionRepositoryPort {
  getOrCreate(userId: string, channel: ChannelType): Promise<Session>;
  appendTurn(
    session: Session,
    turn: Omit<ConversationTurn, "timestamp">,
  ): Promise<Session>;
  updateMetadata(
    session: Session,
    metadata: Record<string, unknown>,
  ): Promise<Session>;
}
