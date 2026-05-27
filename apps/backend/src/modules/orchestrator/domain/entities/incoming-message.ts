import type { ChannelType } from "./channel";

export interface IncomingMessage {
  id: string;
  channel: ChannelType;
  userId: string;
  sessionId: string;
  text: string;
  receivedAt: Date;
  metadata: {
    chatId: number;
  };
}
