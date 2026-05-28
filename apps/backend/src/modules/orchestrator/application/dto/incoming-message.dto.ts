export interface IncomingMessageDto {
	id: string;
	userId: string;
	sessionId: string;
	text: string;
	receivedAt: Date;
	chatId: number;
}
