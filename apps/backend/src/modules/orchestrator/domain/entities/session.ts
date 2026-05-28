import type { ChannelType } from "./channel";

export interface ConversationTurn {
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
}

export interface Session {
	id: string;
	channel: ChannelType;
	userId: string;
	history: ConversationTurn[];
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
	expiresAt: Date;
}
