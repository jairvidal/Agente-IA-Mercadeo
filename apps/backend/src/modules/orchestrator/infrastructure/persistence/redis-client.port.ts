export interface RedisClient {
	get(key: string): Promise<string | null>;
	setex(key: string, ttlSeconds: number, value: string): Promise<void>;
	del(key: string): Promise<void>;
}
