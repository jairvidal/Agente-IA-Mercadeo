import { beforeEach, describe, expect, it } from "bun:test";

import {
  MAX_HISTORY_TURNS,
  SESSION_TTL_SECONDS,
} from "@/modules/orchestrator/domain/constants";
import type { RedisClient } from "../redis-client.port";
import { RedisSessionRepository } from "../redis-session.repository";

class FakeRedisClient implements RedisClient {
  readonly store = new Map<string, string>();
  readonly expiresAt = new Map<string, number>();
  now = () => Date.now();

  async get(key: string): Promise<string | null> {
    const exp = this.expiresAt.get(key);
    if (exp !== undefined && exp <= this.now()) {
      this.store.delete(key);
      this.expiresAt.delete(key);
      return null;
    }
    return this.store.get(key) ?? null;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.store.set(key, value);
    this.expiresAt.set(key, this.now() + ttlSeconds * 1000);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    this.expiresAt.delete(key);
  }
}

describe("RedisSessionRepository", () => {
  let redis: FakeRedisClient;
  let repo: RedisSessionRepository;

  beforeEach(() => {
    redis = new FakeRedisClient();
    repo = new RedisSessionRepository(redis);
  });

  describe("getOrCreate", () => {
    it("creates a new session when none exists", async () => {
      const session = await repo.getOrCreate("user-1", "telegram");

      expect(session.id).toBeString();
      expect(session.userId).toBe("user-1");
      expect(session.channel).toBe("telegram");
      expect(session.history).toEqual([]);
      expect(session.metadata).toEqual({});
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("persists the session in redis with the configured TTL", async () => {
      const session = await repo.getOrCreate("user-1", "telegram");

      const stored = await redis.get(`session:${session.id}`);
      expect(stored).not.toBeNull();

      const ttl = redis.expiresAt.get(`session:${session.id}`)! - Date.now();
      expect(ttl).toBeLessThanOrEqual(SESSION_TTL_SECONDS * 1000);
      expect(ttl).toBeGreaterThan(SESSION_TTL_SECONDS * 1000 - 1000);
    });

    it("returns the existing session for the same user+channel (anaphoric reference)", async () => {
      const first = await repo.getOrCreate("user-1", "telegram");
      const withTurn = await repo.appendTurn(first, {
        role: "user",
        content: "¿dónde queda la tienda de Cali?",
      });

      const second = await repo.getOrCreate("user-1", "telegram");

      expect(second.id).toBe(first.id);
      expect(second.history).toHaveLength(1);
      expect(second.history[0]!.content).toBe(
        "¿dónde queda la tienda de Cali?",
      );
      expect(second.history[0]!.timestamp).toBeInstanceOf(Date);
      expect(second.updatedAt).toEqual(withTurn.updatedAt);
    });

    it("creates a fresh session when the previous one expired (24h reset)", async () => {
      const first = await repo.getOrCreate("user-1", "telegram");
      await repo.appendTurn(first, { role: "user", content: "hola" });

      redis.now = () => Date.now() + (SESSION_TTL_SECONDS + 1) * 1000;

      const second = await repo.getOrCreate("user-1", "telegram");

      expect(second.id).not.toBe(first.id);
      expect(second.history).toEqual([]);
    });

    it("treats different channels as different sessions for the same user", async () => {
      const tg = await repo.getOrCreate("user-1", "telegram");
      const wa = await repo.getOrCreate("user-1", "whatsapp");

      expect(tg.id).not.toBe(wa.id);
      expect(tg.channel).toBe("telegram");
      expect(wa.channel).toBe("whatsapp");
    });
  });

  describe("appendTurn", () => {
    it("appends a turn with a server-side timestamp", async () => {
      const session = await repo.getOrCreate("user-1", "telegram");
      const updated = await repo.appendTurn(session, {
        role: "user",
        content: "hola",
      });

      expect(updated.history).toHaveLength(1);
      expect(updated.history[0]!.role).toBe("user");
      expect(updated.history[0]!.content).toBe("hola");
      expect(updated.history[0]!.timestamp).toBeInstanceOf(Date);
    });

    it("keeps only the last MAX_HISTORY_TURNS turns (sliding window)", async () => {
      let session = await repo.getOrCreate("user-1", "telegram");

      for (let i = 0; i < MAX_HISTORY_TURNS + 5; i++) {
        session = await repo.appendTurn(session, {
          role: i % 2 === 0 ? "user" : "assistant",
          content: `msg-${i}`,
        });
      }

      expect(session.history).toHaveLength(MAX_HISTORY_TURNS);
      expect(session.history[0]!.content).toBe("msg-5");
      expect(session.history[MAX_HISTORY_TURNS - 1]!.content).toBe(
        `msg-${MAX_HISTORY_TURNS + 4}`,
      );
    });

    it("persists changes so the next getOrCreate sees them", async () => {
      const session = await repo.getOrCreate("user-1", "telegram");
      await repo.appendTurn(session, { role: "user", content: "primero" });
      await repo.appendTurn(
        { ...session, history: [{ role: "user", content: "primero", timestamp: new Date() }] },
        { role: "assistant", content: "segundo" },
      );

      const reloaded = await repo.getOrCreate("user-1", "telegram");
      expect(reloaded.history.map((t) => t.content)).toEqual([
        "primero",
        "segundo",
      ]);
    });
  });

  describe("updateMetadata", () => {
    it("merges metadata without losing history", async () => {
      let session = await repo.getOrCreate("user-1", "telegram");
      session = await repo.appendTurn(session, {
        role: "user",
        content: "hola",
      });

      const updated = await repo.updateMetadata(session, { intent: "greeting" });

      expect(updated.metadata).toEqual({ intent: "greeting" });
      expect(updated.history).toHaveLength(1);

      const reloaded = await repo.getOrCreate("user-1", "telegram");
      expect(reloaded.metadata).toEqual({ intent: "greeting" });
    });
  });
});
