import { Redis } from "ioredis";

import type { RedisClient } from "./redis-client.port";

export class IoredisAdapter implements RedisClient {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.client.setex(key, ttlSeconds, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}

let singleton: Redis | null = null;

export function getIoredis(url: string): Redis {
  if (!singleton) {
    singleton = new Redis(url, {
      retryStrategy: (times) => Math.min(times * 200, 5000),
      maxRetriesPerRequest: 3,
    });
  }
  return singleton;
}
