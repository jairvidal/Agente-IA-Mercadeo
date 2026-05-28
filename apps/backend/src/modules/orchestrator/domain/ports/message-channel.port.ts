import type { OutgoingReply } from "@/modules/orchestrator/domain/entities/outgoing-reply";
import type { MessageChannelError } from "@/modules/orchestrator/domain/errors";
import type { Result } from "@/modules/orchestrator/domain/result";

export interface MessageChannelPort {
	send(reply: OutgoingReply): Promise<Result<void, MessageChannelError>>;
}
