import type { OutgoingReply } from "../entities/outgoing-reply";

export interface MessageChannelPort {
  send(reply: OutgoingReply): Promise<void>;
}
