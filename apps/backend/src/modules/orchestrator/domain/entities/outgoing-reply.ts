export interface OutgoingReply {
	sessionId: string;
	text: string;
	metadata: {
		chatId: number;
	};
}
