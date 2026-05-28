import { randomUUID } from "crypto";

import {
	MAX_HISTORY_TURNS,
	SESSION_TTL_SECONDS,
} from "@/modules/orchestrator/domain/constants";
import type { ChannelType } from "@/modules/orchestrator/domain/entities/channel";
import type {
	ConversationTurn,
	Session,
} from "@/modules/orchestrator/domain/entities/session";
import { SessionRepositoryError } from "@/modules/orchestrator/domain/errors";
import type { SessionRepositoryPort } from "@/modules/orchestrator/domain/ports/session-repository.port";
import { err, ok, type Result } from "@/modules/orchestrator/domain/result";

import type { RedisClient } from "./redis-client.port";

interface SerializedSession {
	id: string;
	channel: ChannelType;
	userId: string;
	history: Array<{
		role: ConversationTurn["role"];
		content: string;
		timestamp: string;
	}>;
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
	expiresAt: string;
}

export class RedisSessionRepository implements SessionRepositoryPort {
	constructor(private readonly redis: RedisClient) {}

	async getOrCreate(
		userId: string,
		channel: ChannelType,
	): Promise<Result<Session, SessionRepositoryError>> {
		try {
			const lookupKey = this.lookupKey(channel, userId);
			const existingId = await this.redis.get(lookupKey);

			if (existingId) {
				const raw = await this.redis.get(this.sessionKey(existingId));
				if (raw) {
					return ok(this.deserialize(raw));
				}
				await this.redis.del(lookupKey);
			}

			const now = new Date();
			const session: Session = {
				id: randomUUID(),
				channel,
				userId,
				history: [],
				metadata: {},
				createdAt: now,
				updatedAt: now,
				expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000),
			};

			await this.persist(session);
			await this.redis.setex(lookupKey, SESSION_TTL_SECONDS, session.id);
			return ok(session);
		} catch (cause) {
			return err(new SessionRepositoryError("getOrCreate", cause));
		}
	}

	async appendTurn(
		session: Session,
		turn: Omit<ConversationTurn, "timestamp">,
	): Promise<Result<Session, SessionRepositoryError>> {
		try {
			const updated: Session = {
				...session,
				history: [...session.history, { ...turn, timestamp: new Date() }].slice(
					-MAX_HISTORY_TURNS,
				),
				updatedAt: new Date(),
			};
			await this.persist(updated);
			return ok(updated);
		} catch (cause) {
			return err(new SessionRepositoryError("appendTurn", cause));
		}
	}

	async updateMetadata(
		session: Session,
		metadata: Record<string, unknown>,
	): Promise<Result<Session, SessionRepositoryError>> {
		try {
			const updated: Session = {
				...session,
				metadata: { ...session.metadata, ...metadata },
				updatedAt: new Date(),
			};
			await this.persist(updated);
			return ok(updated);
		} catch (cause) {
			return err(new SessionRepositoryError("updateMetadata", cause));
		}
	}

	private async persist(session: Session): Promise<void> {
		const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
		if (ttl <= 0) return;
		await this.redis.setex(
			this.sessionKey(session.id),
			ttl,
			JSON.stringify(session),
		);
	}

	private deserialize(raw: string): Session {
		const parsed = JSON.parse(raw) as SerializedSession;
		return {
			...parsed,
			createdAt: new Date(parsed.createdAt),
			updatedAt: new Date(parsed.updatedAt),
			expiresAt: new Date(parsed.expiresAt),
			history: parsed.history.map((t) => ({
				...t,
				timestamp: new Date(t.timestamp),
			})),
		};
	}

	private sessionKey(id: string): string {
		return `session:${id}`;
	}

	private lookupKey(channel: ChannelType, userId: string): string {
		return `user-session:${channel}:${userId}`;
	}
}
